import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PublicDocumentsController } from './public-documents.controller';
import { PublicDocumentsService } from './public-documents.service';
import { LocksModule } from '../locks/locks.module';
import { DocumentSigningModule } from '../document-signing/document-signing.module';
import { PublicAccessModule } from '../public-access/public-access.module';

@Module({
  imports: [LocksModule, DocumentSigningModule, PublicAccessModule],
  controllers: [DocumentsController, PublicDocumentsController],
  providers: [DocumentsService, PublicDocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
