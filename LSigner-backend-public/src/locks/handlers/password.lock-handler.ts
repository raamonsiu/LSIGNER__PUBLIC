import * as crypto from 'crypto';
import { promisify } from 'util';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LockType } from '../../entities/document-lock.entity';
import { ILockHandler } from './lock-handler.interface';

/** Minimum password length enforced at the application level. */
const MIN_PASSWORD_LENGTH = 6;

/** Shape of the raw payload expected by this handler. */
export interface PasswordLockPayload {
  password: string;
}

/** Shape of the config stored in "document_locks.config". */
interface PasswordLockConfig {
  hash: string;
  salt: string;
}

/**
 * Lock handler for PASSWORD-type locks.
 *
 * Uses "crypto.scrypt" (memory-hard KDF) with a per-lock random salt to
 * derive a 64-byte key. Verification uses "crypto.timingSafeEqual" to
 * prevent timing-based side-channel attacks — consistent with the auth module.
 */
@Injectable()
export class PasswordLockHandler implements ILockHandler<PasswordLockPayload> {
  readonly type = LockType.PASSWORD;

  private readonly scrypt = promisify(crypto.scrypt);

  /**
   * Hashes the sender's plaintext password with a fresh random salt.
   * @param payload Contains the plaintext "password" field.
   * @returns "{ hash, salt }" safe to persist in the JSONB config column.
   */
  async apply(payload: PasswordLockPayload): Promise<Record<string, unknown>> {
    if (
      typeof payload.password !== 'string' ||
      payload.password.length < MIN_PASSWORD_LENGTH
    ) {
      throw new BadRequestException(
        `PASSWORD lock requires a password of at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const derivedKey = (await this.scrypt(
      payload.password,
      salt,
      64,
    )) as Buffer;

    return {
      hash: derivedKey.toString('hex'),
      salt,
    } satisfies PasswordLockConfig;
  }

  /**
   * Verifies the recipient's password against the stored hash/salt.
   * @param storedConfig The "{ hash, salt }" object persisted at apply time.
   * @param payload Contains the plaintext "password" the recipient provided.
   * @throws UnauthorizedException when the password is incorrect.
   */
  async verify(
    storedConfig: Record<string, unknown>,
    payload: PasswordLockPayload,
  ): Promise<void> {
    const { hash, salt } = storedConfig as unknown as PasswordLockConfig;

    let derivedKey: Buffer;
    try {
      derivedKey = (await this.scrypt(
        payload.password ?? '',
        salt,
        64,
      )) as Buffer;
    } catch {
      throw new UnauthorizedException('Incorrect lock password');
    }

    const matches = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      derivedKey,
    );

    if (!matches) {
      throw new UnauthorizedException('Incorrect lock password');
    }
  }
}
