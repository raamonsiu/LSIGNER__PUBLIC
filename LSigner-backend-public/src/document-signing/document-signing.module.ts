import { Module } from '@nestjs/common';
import { DocumentSigningService } from './document-signing.service';
import { LocksModule } from '../locks/locks.module';

@Module({
  imports: [LocksModule],
  providers: [DocumentSigningService],
  exports: [DocumentSigningService],
})
export class DocumentSigningModule {}
