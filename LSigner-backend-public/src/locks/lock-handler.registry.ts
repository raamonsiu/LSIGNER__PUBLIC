import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LockType } from '../entities/document-lock.entity';
import { ILockHandler } from './handlers/lock-handler.interface';
import { PasswordLockHandler } from './handlers/password.lock-handler';

/**
 * Central registry that maps each LockType to its handler.
 *
 * To add a new lock type:
 * 1. Create a new handler implementing "ILockHandler".
 * 2. Inject it here and register it in the constructor.
 * No other code needs to change.
 */
@Injectable()
export class LockHandlerRegistry {
  private readonly handlers = new Map<LockType, ILockHandler<unknown>>();

  constructor(private readonly passwordHandler: PasswordLockHandler) {
    this.register(passwordHandler);
  }

  private register(handler: ILockHandler<unknown>): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Returns the handler for the given LockType.
   * @throws InternalServerErrorException when no handler is registered.
   */
  get(type: LockType): ILockHandler<unknown> {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new InternalServerErrorException(
        `No handler registered for lock type "${type}"`,
      );
    }
    return handler;
  }
}
