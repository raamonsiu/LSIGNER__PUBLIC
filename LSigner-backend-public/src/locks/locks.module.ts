import { Module } from '@nestjs/common';
import { LocksService } from './locks.service';
import { LockHandlerRegistry } from './lock-handler.registry';
import { PasswordLockHandler } from './handlers/password.lock-handler';

@Module({
  providers: [LocksService, LockHandlerRegistry, PasswordLockHandler],
  exports: [LocksService],
})
export class LocksModule {}
