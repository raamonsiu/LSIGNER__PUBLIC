import { LockType } from '../../entities/document-lock.entity';

/**
 * Contract for all document lock handlers.
 *
 * Each handler is responsible for a single LockType and encapsulates:
 * - "apply": derives a safe config to persist from the sender's raw payload.
 * - "verify": checks a recipient's resolution payload against the stored config.
 *
 * This follows the handler / strategy variant of the decorator pattern:
 * adding a new lock type means only registering a new ILockHandler
 * implementation — no changes to DocumentsService or LocksService are needed.
 *
 * @template TPayload Shape of the raw payload (same for apply and verify).
 */
export interface ILockHandler<TPayload = Record<string, unknown>> {
  readonly type: LockType;

  /**
   * Transforms the sender's raw payload into a safe config for persistence.
   * For example, a password handler hashes the plaintext before storing it.
   *
   * @param payload Raw data provided by the document sender.
   * @returns A JSONB-compatible object to store in "document_locks.config".
   * @throws BadRequestException if the payload is invalid for this lock type.
   */
  apply(payload: TPayload): Promise<Record<string, unknown>>;

  /**
   * Verifies the recipient's resolution payload against the stored config.
   *
   * @param storedConfig The value previously returned by "apply".
   * @param payload Raw data provided by the recipient.
   * @throws UnauthorizedException if verification fails.
   */
  verify(
    storedConfig: Record<string, unknown>,
    payload: TPayload,
  ): Promise<void>;
}
