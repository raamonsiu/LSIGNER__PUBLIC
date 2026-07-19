import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { EntityManager, QueryFailedError } from 'typeorm';
import { OtpChallenge } from '../entities/otp-challenge.entity';
import { OtpChallengeStatus } from './enums/otp-challenge-status.enum';
import type { OtpActionType } from './enums/otp-action-type.enum';
import type { OtpResourceType } from './enums/otp-resource-type.enum';
import type { CreateOtpChallengeDto } from './dto/create-otp-challenge.dto';
import type { OtpChallengeResponseDto } from './dto/otp-challenge-response.dto';
import type { OtpResendResponseDto } from './dto/otp-resend-response.dto';
import { Document, DocumentStatus } from '../entities/document.entity';
import type { DocumentRecipient } from '../entities/document-recipient.entity';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttlSeconds: number;
  private readonly otpLength: number;

  /**
   * Exposes the configured OTP TTL in seconds.
   * Used by controllers to format expiry info for email templates.
   */
  getTtlSeconds(): number {
    return this.ttlSeconds;
  }
  private readonly maxAttempts: number;
  private readonly lockMinutes: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxResends: number;

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    configService: ConfigService,
  ) {
    this.ttlSeconds = configService.get<number>('otp.ttlSeconds')!;
    this.otpLength = configService.get<number>('otp.length')!;
    this.maxAttempts = configService.get<number>('otp.maxAttempts')!;
    this.lockMinutes = configService.get<number>('otp.lockMinutes')!;
    this.resendCooldownSeconds = configService.get<number>(
      'otp.resendCooldownSeconds',
    )!;
    this.maxResends = configService.get<number>('otp.maxResends')!;
  }

  /**
   * Generates a random numeric OTP of configured length.
   * Never logs or exposes the OTP value.
   */
  generateOtp(): string {
    const max = Math.pow(10, this.otpLength);
    const min = Math.pow(10, this.otpLength - 1);
    const otp = crypto.randomInt(min, max).toString();
    return otp;
  }

  /**
   * Hashes an OTP with a random salt using SHA-256.
   * Returns both the hash and salt.
   */
  hashOtp(otp: string): { otpHash: string; otpSalt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(otp + salt)
      .digest('hex');
    return { otpHash: hash, otpSalt: salt };
  }

  /**
   * Verifies an OTP against a stored hash and salt.
   * Uses timing-safe comparison.
   */
  verifyOtpHash(otp: string, storedHash: string, storedSalt: string): boolean {
    const computedHash = crypto
      .createHash('sha256')
      .update(otp + storedSalt)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  }

  /**
   * Creates a new OTP challenge, hashes the code, and returns the response.
   *
   * **Race prevention**: Uses `SELECT ... FOR UPDATE` (pessimistic_write) to lock
   * any existing ACTIVE challenges for the same scope before cancelling them.
   * This prevents two concurrent requests from both creating a challenge for the
   * same scope (the second transaction waits until the first commits).
   *
   * **Resend resets lockout**: When a challenge is resent (via `resendChallenge`),
   * the `attempt_count` and `locked_until` fields are reset to zero, giving the
   * user a fresh set of attempts. This means a resend is an escape hatch from a
   * locked-out state without waiting for the lock timeout.
   *
   * Cancels any prior ACTIVE challenge for the same scope.
   */
  async createChallenge(
    userId: string,
    dto: CreateOtpChallengeDto,
    metadata: Record<string, unknown>,
    transactionalEntityManager?: EntityManager,
  ): Promise<{
    challenge: OtpChallenge;
    plainOtp: string;
    response: OtpChallengeResponseDto;
  }> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Lock existing active challenges for this scope to prevent race conditions
    // where two concurrent requests could both skip the cancel and create duplicates.
    // The pessimistic_write lock (SELECT ... FOR UPDATE) blocks concurrent transactions
    // until the current transaction commits, serializing the cancel-then-create flow.
    await entityManager
      .createQueryBuilder(OtpChallenge, 'oc')
      .setLock('pessimistic_write')
      .where(
        'user_id = :userId AND action_type = :actionType AND resource_type = :resourceType AND resource_id = :resourceId AND status = :activeStatus',
        {
          userId,
          actionType: dto.actionType,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          activeStatus: OtpChallengeStatus.ACTIVE,
        },
      )
      .getMany();

    await entityManager
      .createQueryBuilder()
      .update(OtpChallenge)
      .set({
        status: OtpChallengeStatus.CANCELLED,
        metadata: () =>
          `metadata || '{"cancelledReason": "replaced_by_new_challenge"}'::jsonb`,
      })
      .where(
        'user_id = :userId AND action_type = :actionType AND resource_type = :resourceType AND resource_id = :resourceId AND status = :activeStatus',
        {
          userId,
          actionType: dto.actionType,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          activeStatus: OtpChallengeStatus.ACTIVE,
        },
      )
      .execute();

    const plainOtp = this.generateOtp();
    const { otpHash, otpSalt } = this.hashOtp(plainOtp);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const resendAvailableAt = new Date(
      now.getTime() + this.resendCooldownSeconds * 1000,
    );

    const challenge = entityManager.create(OtpChallenge, {
      user_id: userId,
      action_type: dto.actionType,
      resource_type: dto.resourceType,
      resource_id: dto.resourceId,
      otp_hash: otpHash,
      otp_salt: otpSalt,
      expires_at: expiresAt,
      attempt_count: 0,
      max_attempts: this.maxAttempts,
      resend_count: 0,
      max_resends: this.maxResends,
      resend_available_at: resendAvailableAt,
      locked_until: null,
      status: OtpChallengeStatus.ACTIVE,
      metadata,
    });

    let saved: OtpChallenge;
    try {
      saved = await entityManager.save(challenge);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          'An active OTP challenge already exists for this action',
        );
      }
      throw err;
    }

    const maskedDestination = this.maskEmail((metadata.email as string) ?? '');

    const response: OtpChallengeResponseDto = {
      challengeId: saved.id,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      maskedDestination,
      remainingAttempts: this.maxAttempts,
      remainingResends: this.maxResends,
    };

    this.logger.log(
      `OTP challenge created: ${saved.id} for user ${userId} action ${dto.actionType} resource ${dto.resourceId}`,
    );

    return { challenge: saved, plainOtp, response };
  }

  /**
   * Resends an OTP for an existing challenge (re-hashes the new code).
   *
   * **Lockout reset**: A resend resets `attempt_count` to 0 and clears
   * `locked_until`. This means resending is also an escape hatch from a
   * locked-out challenge : the user can get a new code and retry immediately
   * without waiting for the lock timeout. The lockout is a rate-limit on
   * incorrect guesses per code, not a permanent block on the user.
   */
  async resendChallenge(
    challengeId: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
    expectedAuthContext?: string,
  ): Promise<{
    plainOtp: string;
    response: OtpResendResponseDto;
    challenge: OtpChallenge;
  }> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const challenge = await entityManager
      .createQueryBuilder(OtpChallenge, 'oc')
      .addSelect(['oc.otp_hash', 'oc.otp_salt'])
      .where('oc.id = :id', { id: challengeId })
      .getOne();

    if (!challenge) {
      throw new ForbiddenException('Challenge not found');
    }

    if (challenge.user_id !== userId) {
      throw new ForbiddenException('Challenge does not belong to this user');
    }

    if (challenge.status !== OtpChallengeStatus.ACTIVE) {
      throw new ConflictException(
        `Challenge is ${challenge.status.toLowerCase()} and cannot be resent`,
      );
    }

    if (challenge.expires_at < new Date()) {
      challenge.status = OtpChallengeStatus.EXPIRED;
      await entityManager.save(challenge);
      throw new GoneException('OTP has expired');
    }

    if (challenge.locked_until && challenge.locked_until > new Date()) {
      throw new ConflictException('Challenge is temporarily locked');
    }

    if (challenge.resend_count >= challenge.max_resends) {
      throw new ConflictException(
        'Maximum number of resends reached for this challenge',
      );
    }

    if (
      challenge.resend_available_at &&
      challenge.resend_available_at > new Date()
    ) {
      const remainingSeconds = Math.ceil(
        (challenge.resend_available_at.getTime() - Date.now()) / 1000,
      );
      throw new ConflictException(
        `Please wait ${remainingSeconds} seconds before requesting a resend`,
      );
    }

    if (
      expectedAuthContext &&
      (challenge.metadata.authContext as string | undefined) !==
        expectedAuthContext
    ) {
      const isPublicContext = expectedAuthContext === 'PUBLIC_SESSION';
      throw new ForbiddenException(
        isPublicContext
          ? 'Challenge must be used from private OTP endpoint'
          : 'Challenge must be resent from public OTP endpoint',
      );
    }

    const plainOtp = this.generateOtp();
    const { otpHash, otpSalt } = this.hashOtp(plainOtp);

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const nextResendAvailableAt = new Date(
      now.getTime() + this.resendCooldownSeconds * 1000,
    );

    challenge.otp_hash = otpHash;
    challenge.otp_salt = otpSalt;
    challenge.expires_at = newExpiresAt;
    challenge.resend_count += 1;
    challenge.resend_available_at = nextResendAvailableAt;
    challenge.attempt_count = 0;
    challenge.locked_until = null;
    challenge.status = OtpChallengeStatus.ACTIVE;

    await entityManager.save(challenge);

    const response: OtpResendResponseDto = {
      challengeId: challenge.id,
      expiresAt: newExpiresAt.toISOString(),
      resendAvailableAt: nextResendAvailableAt.toISOString(),
      remainingResends: challenge.max_resends - challenge.resend_count,
    };

    this.logger.log(
      `OTP resent for challenge ${challengeId} (resend #${challenge.resend_count})`,
    );

    return { plainOtp, response, challenge };
  }

  /**
   * Verifies an OTP code for a given challenge.
   * Increments attempt count, locks on max attempts.
   * Throws on invalid, expired, consumed, or locked challenges.
   */
  async verifyChallenge(
    challengeId: string,
    code: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
    expectedAuthContext?: string,
  ): Promise<OtpChallenge> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const challenge = await entityManager
      .createQueryBuilder(OtpChallenge, 'oc')
      .addSelect(['oc.otp_hash', 'oc.otp_salt'])
      .where('oc.id = :id', { id: challengeId })
      .getOne();

    if (!challenge) {
      throw new ForbiddenException('Challenge not found');
    }

    if (challenge.user_id !== userId) {
      throw new ForbiddenException('Challenge does not belong to this user');
    }

    if (
      expectedAuthContext &&
      (challenge.metadata.authContext as string | undefined) !==
        expectedAuthContext
    ) {
      throw new ForbiddenException(
        expectedAuthContext === 'PUBLIC_SESSION'
          ? 'Challenge must be used from private OTP endpoint'
          : 'Challenge must be verified from public OTP endpoint',
      );
    }

    if (challenge.status === OtpChallengeStatus.CONSUMED) {
      throw new ConflictException('OTP has already been used');
    }

    if (challenge.status === OtpChallengeStatus.CANCELLED) {
      throw new ConflictException('OTP challenge was cancelled');
    }

    if (challenge.status === OtpChallengeStatus.LOCKED) {
      if (challenge.locked_until && challenge.locked_until > new Date()) {
        const remainingSeconds = Math.ceil(
          (challenge.locked_until.getTime() - Date.now()) / 1000,
        );
        throw new ConflictException(
          `Challenge is locked. Try again in ${remainingSeconds} seconds`,
        );
      }
      challenge.status = OtpChallengeStatus.ACTIVE;
      challenge.locked_until = null;
      challenge.attempt_count = 0;
    }

    if (challenge.expires_at < new Date()) {
      challenge.status = OtpChallengeStatus.EXPIRED;
      await entityManager.save(challenge);
      throw new GoneException('OTP has expired');
    }

    challenge.attempt_count += 1;

    const isValid = this.verifyOtpHash(
      code,
      challenge.otp_hash,
      challenge.otp_salt,
    );

    if (!isValid) {
      if (challenge.attempt_count >= challenge.max_attempts) {
        challenge.status = OtpChallengeStatus.LOCKED;
        challenge.locked_until = new Date(
          Date.now() + this.lockMinutes * 60 * 1000,
        );
        await entityManager.save(challenge);
        this.logger.warn(
          `OTP challenge ${challengeId} locked due to max attempts exceeded`,
        );
        throw new UnprocessableEntityException(
          'Maximum attempts exceeded. Challenge is locked.',
        );
      }

      await entityManager.save(challenge);
      const remaining = challenge.max_attempts - challenge.attempt_count;
      throw new UnprocessableEntityException(
        `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      );
    }

    challenge.status = OtpChallengeStatus.CONSUMED;
    await entityManager.save(challenge);

    this.logger.log(
      `OTP challenge ${challengeId} verified successfully for user ${userId}`,
    );

    return challenge;
  }

  /**
   * Resolves a document and its recipient for a JWT-authenticated user,
   * validates access rights, and returns the data needed to create a challenge.
   * Throws 404 / 403 if the document is not found or the user has no access.
   */
  async resolveJwtChallengeContext(
    documentId: string,
    userId: string,
    transactionalEntityManager: EntityManager,
  ): Promise<{
    document: Document;
    recipient: DocumentRecipient | null;
    signingStatus: string | undefined;
    email: string;
  }> {
    const document = await transactionalEntityManager.findOne(Document, {
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const recipient = await transactionalEntityManager
      .createQueryBuilder()
      .select('dr')
      .from('document_recipients', 'dr')
      .where('dr.document_id = :documentId AND dr.user_id = :userId', {
        documentId,
        userId,
      })
      .getOne();

    if (!recipient && document.owner_id !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    const recipientRecord = recipient as unknown as DocumentRecipient | null;
    const signingStatus = (
      recipientRecord as unknown as { signing_status: string } | null
    )?.signing_status;

    const email = recipientRecord?.recipient_email ?? '';

    return { document, recipient: recipientRecord, signingStatus, email };
  }

  /**
   * Resolves a public session recipient with document data and validates
   * the resource ID matches the session's document. Returns the data needed
   * to create a challenge.
   */
  async resolvePublicChallengeContext(
    resourceId: string,
    recipientId: string,
    sessionDocumentId: string,
    transactionalEntityManager: EntityManager,
  ): Promise<{
    signingStatus: string;
    documentStatus: DocumentStatus;
    email: string;
  }> {
    if (resourceId !== sessionDocumentId) {
      throw new ForbiddenException(
        'Resource does not match current public session',
      );
    }

    const recipient = await transactionalEntityManager
      .createQueryBuilder()
      .select('dr')
      .from('document_recipients', 'dr')
      .innerJoinAndSelect('dr.document', 'doc')
      .where('dr.id = :recipientId AND dr.document_id = :documentId', {
        recipientId,
        documentId: sessionDocumentId,
      })
      .getOne();

    if (!recipient) {
      throw new NotFoundException('Public recipient invitation not found');
    }

    const recipientRecord = recipient as unknown as {
      signing_status: string;
      recipient_email: string;
      document: { status: DocumentStatus };
    };

    return {
      signingStatus: recipientRecord.signing_status,
      documentStatus: recipientRecord.document.status,
      email: recipientRecord.recipient_email,
    };
  }

  /**
   * Finds an active challenge by scope. Used for validation before creation.
   */
  async findActiveChallenge(
    userId: string,
    actionType: string,
    resourceType: string,
    resourceId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<OtpChallenge | null> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    return entityManager.findOne(OtpChallenge, {
      where: {
        user_id: userId,
        action_type: actionType as OtpActionType,
        resource_type: resourceType as OtpResourceType,
        resource_id: resourceId,
        status: OtpChallengeStatus.ACTIVE,
      },
    });
  }

  /**
   * Expires all challenges that are past their TTL.
   * Called periodically or on demand.
   */
  async expireStaleChallenges(
    transactionalEntityManager?: EntityManager,
  ): Promise<number> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const result = await entityManager
      .createQueryBuilder()
      .update(OtpChallenge)
      .set({ status: OtpChallengeStatus.EXPIRED })
      .where('status = :status', {
        status: OtpChallengeStatus.ACTIVE,
      })
      .andWhere('expires_at < :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  /**
   * Unlocks challenges whose lock time has expired.
   */
  async unlockExpiredLocks(
    transactionalEntityManager?: EntityManager,
  ): Promise<number> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const result = await entityManager
      .createQueryBuilder()
      .update(OtpChallenge)
      .set({
        status: OtpChallengeStatus.ACTIVE,
        locked_until: null,
        attempt_count: 0,
      })
      .where('status = :status', {
        status: OtpChallengeStatus.LOCKED,
      })
      .andWhere('locked_until IS NOT NULL')
      .andWhere('locked_until < :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) {
      return email.substring(0, 2) + '***';
    }
    const maskedLocal =
      local.length > 2
        ? local[0] +
          '*'.repeat(Math.min(local.length - 2, 5)) +
          local[local.length - 1]
        : local[0] + '*';
    return `${maskedLocal}@${domain}`;
  }
}
