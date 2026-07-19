import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectEntityManager } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { promisify } from 'util';
import ms, { type StringValue } from 'ms';
import { EntityManager } from 'typeorm';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { normalizeEmail } from '../common/utils/normalize';
import type { JwtPayload } from './decorators/current-user.decorator';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { TokensResponseDto } from './dto/tokens-response.dto';

@Injectable()
export class AuthService {
  // Used when no real user is found so verifyPassword still runs and keeps
  // timing consistent : prevents user-enumeration via response latency.
  private static readonly DUMMY_HASH = '0'.repeat(128);
  private static readonly DUMMY_SALT = '0'.repeat(64);

  private readonly scrypt = promisify(crypto.scrypt);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  // ====================================================
  // Public API
  // ====================================================

  /**
   * Validates the provided credentials and, on success, issues a new access /
   * refresh token pair.
   *
   * The error message is intentionally generic to avoid leaking whether the
   * email exists in the system (user-enumeration prevention).
   *
   * @param dto Login credentials (email + password)
   * @param transactionalEntityManager EntityManager passed from the controller transaction
   */
  async login(
    dto: LoginDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<TokensResponseDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const canonicalEmail = normalizeEmail(dto.email);

    // Query Builder is more flexible than entityManger.get (.get is, indeed, an abstraction of a queryBuilder)
    const user = await entityManager
      .createQueryBuilder(User, 'u')
      .addSelect(['u.password', 'u.salt'])
      .where('u.email = :email', { email: canonicalEmail })
      .getOne();

    // Always run the comparison : even if user is absent : to keep timing
    // constant and prevent user-enumeration via latency differences.
    const hash = user?.password ?? AuthService.DUMMY_HASH;
    const salt = user?.salt ?? AuthService.DUMMY_SALT;
    const passwordMatch = await this.verifyPassword(dto.password, hash, salt);

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deleted_at) {
      throw new UnauthorizedException('Deleted account');
    }

    return this.issueTokens(user, entityManager);
  }

  /**
   * Exchanges a valid (non-revoked, non-expired) refresh token for a new
   * access / refresh token pair. The old refresh token is revoked immediately
   * (token rotation) to limit the blast radius of a leaked token.
   *
   * The pessimistic write lock requires an active DB transaction; if no
   * transactionalEntityManager is provided the method wraps the operation
   * in its own transaction so the lock is always applied correctly.
   *
   * @param dto Body containing the current refresh token
   * @param transactionalEntityManager Optional EntityManager from the caller's transaction
   */
  async refresh(
    dto: RefreshTokenDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<TokensResponseDto> {
    const tokenHash = this.hashToken(dto.refresh_token);

    const doRefresh = async (
      entityManager: EntityManager,
    ): Promise<TokensResponseDto> => {
      // Pessimistic lock to avoid race conditions where the same refresh token
      // could be consumed twice concurrently. This issues a SELECT ... FOR
      // UPDATE when supported by the DB and the call is inside a transaction.
      const stored = await entityManager
        .createQueryBuilder(RefreshToken, 'rt')
        .setLock('pessimistic_write') // SELECT FOR UPDATE LOCK (MUTEX, REMEMBER PROSO?)
        .where('rt.token_hash = :hash AND rt.revoked = false', {
          hash: tokenHash,
        })
        .getOne();

      if (!stored || stored.expires_at < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Revoke the current token before issuing a new one (rotation)
      stored.revoked = true;
      await entityManager.save(stored);

      const user = await entityManager.findOne(User, {
        where: { patient_id: stored.user_id },
      });

      if (!user) {
        throw new UnauthorizedException('Associated user no longer exists');
      }

      return this.issueTokens(user, entityManager);
    };

    if (transactionalEntityManager) {
      return doRefresh(transactionalEntityManager);
    }

    return this.entityManager.transaction((entityManager) =>
      doRefresh(entityManager),
    );
  }

  /**
   * Verifies that "password" matches the stored hash for the user identified
   * by "patientId". Throws "UnauthorizedException" if the user no longer
   * exists or the password does not match.
   *
   * This is a pure verification : no tokens are issued and no state is
   * changed. The frontend uses this to gate sensitive operations (email
   * change, phone update, etc.).
   *
   * @param patientId User UUID from JWT
   * @param password  Plain-text password to verify
   * @param transactionalEntityManager EntityManager passed from the controller transaction
   */
  async verifyUserPassword(
    patientId: string,
    password: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const user = await entityManager
      .createQueryBuilder(User, 'u')
      .addSelect(['u.password', 'u.salt'])
      .where('u.patient_id = :patientId', { patientId })
      .getOne();

    const hash = user?.password ?? AuthService.DUMMY_HASH;
    const salt = user?.salt ?? AuthService.DUMMY_SALT;
    const passwordMatch = await this.verifyPassword(password, hash, salt);

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid password');
    }
  }

  /**
   * Revokes a refresh token, effectively ending the session.
   * No error is thrown when the token is already revoked or unknown :
   * callers can safely call this regardless of token state.
   *
   * @param dto Body containing the refresh token to invalidate
   * @param transactionalEntityManager EntityManager passed from the controller transaction
   */
  async logout(
    dto: RefreshTokenDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const tokenHash = this.hashToken(dto.refresh_token);
    await entityManager.update(
      RefreshToken,
      { token_hash: tokenHash, revoked: false },
      { revoked: true },
    );
  }

  // ====================================================
  // Helpers
  // ====================================================

  /**
   * Generates a JWT access token and a new opaque refresh token for "user",
   * persists the refresh token hash, and returns both to the caller.
   *
   * @param user Authenticated user entity
   * @param entityManager Active EntityManager (from the caller's transaction)
   */
  private async issueTokens(
    user: User,
    entityManager: EntityManager,
  ): Promise<TokensResponseDto> {
    const payload: JwtPayload = { sub: user.patient_id, email: user.email };

    // Read expiry once so the JWT exp claim and the expires_in response field
    // are always derived from the same value and cannot diverge.
    const jwtExpiresIn =
      this.configService.get<string>('auth.jwtExpiresIn') ?? '15m';

    const access_token = this.jwtService.sign(payload, {
      expiresIn: jwtExpiresIn as StringValue,
    });

    // Generate a cryptographically random opaque token (48 bytes -> 96 hex chars)
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshExpiresIn =
      this.configService.get<string>('auth.jwtRefreshExpiresIn') ?? '7d';

    const refreshRecord = entityManager.create(RefreshToken, {
      user_id: user.patient_id,
      token_hash: tokenHash,
      expires_at: this.addDuration(refreshExpiresIn),
    });
    await entityManager.save(refreshRecord);

    return {
      access_token,
      refresh_token: rawRefreshToken,
      expires_in: this.durationToSeconds(jwtExpiresIn),
    };
  }

  /**
   * Verifies "plain" against the stored "hash"/"salt" using scrypt.
   * Uses "crypto.timingSafeEqual" to prevent timing-based attacks.
   */
  private async verifyPassword(
    plain: string,
    hash: string,
    salt: string,
  ): Promise<boolean> {
    try {
      const derivedKey = (await this.scrypt(plain, salt, 64)) as Buffer;
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
    } catch {
      return false;
    }
  }

  /** SHA-256 hex digest of "token". */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Returns a future "Date" offset by "duration" from now.
   * Supports the same formats as jsonwebtoken/ms (e.g. '15m', '1h', '7d').
   */
  private addDuration(duration: string): Date {
    return new Date(Date.now() + this.durationToMs(duration));
  }

  /**
   * Converts a duration string to milliseconds using the same "ms" package
   * that jsonwebtoken uses internally, guaranteeing that "expires_in" and
   * the JWT "exp" claim are always derived from identical logic.
   *
   * Throws if the format is not recognised by "ms" (e.g. bare integers
   * without a unit, decimals, or unknown suffixes).
   */
  private durationToMs(duration: string): number {
    const result = ms(duration as StringValue);
    if (result === undefined) {
      throw new Error(
        `Invalid duration format: ${duration}. Accepted formats: '15m', '1h', '7d', etc.`,
      );
    }
    return result;
  }

  private durationToSeconds(duration: string): number {
    return Math.floor(this.durationToMs(duration) / 1_000);
  }
}
