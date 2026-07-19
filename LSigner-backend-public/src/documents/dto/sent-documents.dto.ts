import { ApiProperty } from '@nestjs/swagger';
import { SigningStatus } from '../../entities/document-recipient.entity';
import { IsEnum } from 'class-validator';

export enum SentDocumentStatus {
  DRAFT = 'DRAFT',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  VOIDED = 'VOIDED',
  SUPERSEDED = 'SUPERSEDED',
  DELETED = 'DELETED',
}

export class SentDocumentsStatsDto {
  @ApiProperty({
    description: 'Total sent documents for the authenticated owner',
    example: 14,
  })
  total_sent: number;

  @ApiProperty({
    description: 'Documents still waiting for final signature',
    example: 5,
  })
  pending_final_signature: number;

  @ApiProperty({
    description: 'Unique recipient emails across all sent documents',
    example: 12,
  })
  unique_recipients: number;

  @ApiProperty({
    description: 'Documents fully signed by all recipients',
    example: 9,
  })
  completed: number;
}

export class SentDocumentListItemDto {
  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  id: string;

  @ApiProperty({
    description: 'Document display name',
    example: 'Employment Contract 2026',
  })
  document_name: string;

  @ApiProperty({
    description: 'Document file size in bytes',
    example: 1048576,
  })
  file_size_bytes: number;

  @ApiProperty({
    description: 'UTC datetime when the document was first sent',
    example: '2026-06-22T11:00:00.000Z',
  })
  sent_at: string;

  @ApiProperty({
    description: 'UTC datetime when the final recipient signed',
    nullable: true,
    example: '2026-06-23T14:15:00.000Z',
  })
  signed_at: string | null;

  @ApiProperty({
    description: 'Display name of the final recipient that completed signature',
    nullable: true,
    example: 'Alice Cooper',
  })
  final_recipient_name: string | null;

  @ApiProperty({
    enum: SentDocumentStatus,
    description: 'Derived status for sent-documents UX',
    example: SentDocumentStatus.WAITING,
  })
  @IsEnum(SentDocumentStatus)
  status: SentDocumentStatus;
}

export class SentDocumentsResponseDto {
  @ApiProperty({ type: SentDocumentsStatsDto })
  stats: SentDocumentsStatsDto;

  @ApiProperty({ type: [SentDocumentListItemDto] })
  items: SentDocumentListItemDto[];
}

export class SentDocumentRecipientDetailDto {
  @ApiProperty({
    description: 'Recipient UUID',
    example: '2ab6f83d-c862-4b9f-9955-117935f6ee56',
  })
  id: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'alice@example.com',
  })
  recipient_email: string;

  @ApiProperty({
    description: 'Recipient display name',
    nullable: true,
    example: 'Alice Cooper',
  })
  recipient_name: string | null;

  @ApiProperty({
    description: 'UTC datetime when invitation was sent to recipient',
    example: '2026-06-22T11:00:00.000Z',
  })
  sent_at: string;

  @ApiProperty({
    enum: SigningStatus,
    description: 'Signature status for this recipient',
    example: SigningStatus.PENDING,
  })
  @IsEnum(SigningStatus)
  signing_status: SigningStatus;

  @ApiProperty({
    description: 'UTC datetime of first recipient access via shared link',
    nullable: true,
    example: '2026-06-22T11:08:02.123Z',
  })
  first_accessed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime of latest recipient access via shared link',
    nullable: true,
    example: '2026-06-22T11:16:45.781Z',
  })
  last_accessed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when recipient signed the document',
    nullable: true,
    example: '2026-06-22T11:20:00.000Z',
  })
  signed_at: string | null;
}

export class SentRecipientListItemDto {
  @ApiProperty({ description: 'Recipient email', example: 'alice@example.com' })
  recipient_email: string;

  @ApiProperty({
    description: 'Recipient display name',
    nullable: true,
    example: 'Alice Cooper',
  })
  recipient_name: string | null;

  @ApiProperty({
    enum: SigningStatus,
    description: 'Signature status for this recipient',
    example: SigningStatus.PENDING,
  })
  signing_status: SigningStatus;

  @ApiProperty({
    description: 'UTC datetime when recipient signed',
    nullable: true,
    example: '2026-06-23T14:15:00.000Z',
  })
  signed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when invitation was sent',
    example: '2026-06-22T11:00:00.000Z',
  })
  sent_at: string;

  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  document_id: string;

  @ApiProperty({
    description: 'Document display name',
    example: 'Employment Contract 2026',
  })
  document_name: string;

  @ApiProperty({
    description: 'UTC datetime of first recipient access',
    nullable: true,
    example: '2026-06-22T11:08:02.123Z',
  })
  first_accessed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime of latest recipient access',
    nullable: true,
    example: '2026-06-22T11:16:45.781Z',
  })
  last_accessed_at: string | null;
}

export class SentRecipientsStatsDto {
  @ApiProperty({
    description: 'Total number of recipient rows across all sent documents',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Recipients with PENDING signing status',
    example: 8,
  })
  pending: number;

  @ApiProperty({
    description: 'Recipients with SIGNED signing status',
    example: 12,
  })
  signed: number;

  @ApiProperty({
    description: 'Recipients with REJECTED signing status',
    example: 3,
  })
  rejected: number;

  @ApiProperty({
    description: 'Recipients with REVOKED signing status',
    example: 2,
  })
  revoked: number;
}

export class SentRecipientsListResponseDto {
  @ApiProperty({ type: SentRecipientsStatsDto })
  stats: SentRecipientsStatsDto;

  @ApiProperty({ type: [SentRecipientListItemDto] })
  items: SentRecipientListItemDto[];
}

export class SentDocumentViewUrlDto {
  @ApiProperty({
    description: 'View URL for the sent document owner',
    example:
      'http://localhost:3001/documents/sent/c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  url: string;
}

export class SentDocumentDetailDto {
  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  id: string;

  @ApiProperty({
    description: 'Document display name',
    example: 'Employment Contract 2026',
  })
  document_name: string;

  @ApiProperty({
    description: 'Document description',
    nullable: true,
    example: 'NDA contract for external consultant',
  })
  description: string | null;

  @ApiProperty({
    description: 'Document file size in bytes',
    example: 1048576,
  })
  file_size_bytes: number;

  @ApiProperty({
    description: 'Original uploaded filename',
    example: 'contract.pdf',
  })
  original_filename: string;

  @ApiProperty({
    description: 'Document MIME type',
    example: 'application/pdf',
  })
  mime_type: string;

  @ApiProperty({
    description: 'Document version number',
    example: 2,
  })
  version: number;

  @ApiProperty({
    enum: SentDocumentStatus,
    description: 'Derived status for sent-documents UX',
    example: SentDocumentStatus.COMPLETED,
  })
  @IsEnum(SentDocumentStatus)
  status: SentDocumentStatus;

  @ApiProperty({
    description: 'UTC datetime when the document was first sent',
    example: '2026-06-22T11:00:00.000Z',
  })
  sent_at: string;

  @ApiProperty({
    description: 'UTC datetime when the final recipient signed',
    nullable: true,
    example: '2026-06-23T14:15:00.000Z',
  })
  signed_at: string | null;

  @ApiProperty({
    description: 'Display name of the final recipient that completed signature',
    nullable: true,
    example: 'Alice Cooper',
  })
  final_recipient_name: string | null;

  @ApiProperty({
    description: 'UTC datetime when document record was created',
    example: '2026-06-21T10:00:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'UTC datetime when document record was last updated',
    example: '2026-06-22T11:00:00.000Z',
  })
  updated_at: string;

  @ApiProperty({ type: [SentDocumentRecipientDetailDto] })
  recipients: SentDocumentRecipientDetailDto[];
}
