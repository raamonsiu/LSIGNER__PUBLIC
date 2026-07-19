import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/normalize';

export enum ReceivedDocumentStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
}

export class ReceivedDocumentsStatsDto {
  @ApiProperty({
    description: 'Total received documents for the authenticated user',
    example: 5,
  })
  total_received: number;

  @ApiProperty({
    description: 'Documents pending my signature',
    example: 2,
  })
  pending_my_signature: number;

  @ApiProperty({
    description: 'Documents signed by me',
    example: 2,
  })
  signed_by_me: number;

  @ApiProperty({
    description: 'Documents rejected or revoked',
    example: 1,
  })
  rejected_or_revoked: number;
}

export class ReceivedDocumentListItemDto {
  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  id: string;

  @ApiProperty({
    description: 'Document display name',
    example: 'NDA ACME',
  })
  document_name: string;

  @ApiProperty({
    description: 'Document file size in bytes',
    example: 204800,
  })
  file_size_bytes: number;

  @ApiProperty({
    description: 'UTC datetime when the document was received',
    example: '2026-06-20T09:00:00.000Z',
  })
  received_at: string;

  @ApiProperty({
    description: 'UTC datetime when I signed',
    nullable: true,
    example: '2026-06-21T10:00:00.000Z',
  })
  signed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when the document expires',
    nullable: true,
    example: null,
  })
  expires_at: string | null;

  @ApiProperty({
    description: 'Sender display name',
    example: 'Alice Example',
  })
  sender_name: string;

  @ApiProperty({
    description: 'Sender email address',
    example: 'alice@example.com',
  })
  sender_email: string;

  @ApiProperty({
    enum: ReceivedDocumentStatus,
    description: 'My signature status on this document',
    example: ReceivedDocumentStatus.PENDING,
  })
  @IsEnum(ReceivedDocumentStatus)
  status: ReceivedDocumentStatus;
}

export class ReceivedDocumentsResponseDto {
  @ApiProperty({ type: ReceivedDocumentsStatsDto })
  stats: ReceivedDocumentsStatsDto;

  @ApiProperty({ type: [ReceivedDocumentListItemDto] })
  items: ReceivedDocumentListItemDto[];
}

export class ReceivedDocumentSenderDto {
  @ApiProperty({
    description: 'Sender user UUID',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  id: string;

  @ApiProperty({
    description: 'Sender full name',
    example: 'Alice Example',
  })
  name: string;

  @ApiProperty({
    description: 'Sender email address',
    example: 'alice@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Whether the sender account has been deleted',
    example: false,
  })
  deleted: boolean;
}

export class ReceivedDocumentMyRecipientDto {
  @ApiProperty({
    description: 'Recipient UUID',
    example: '2ab6f83d-c862-4b9f-9955-117935f6ee56',
  })
  id: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'me@example.com',
  })
  recipient_email: string;

  @ApiProperty({
    description: 'Recipient display name',
    nullable: true,
    example: 'My Name',
  })
  recipient_name: string | null;

  @ApiProperty({
    enum: ReceivedDocumentStatus,
    description: 'My signature status',
    example: ReceivedDocumentStatus.PENDING,
  })
  @IsEnum(ReceivedDocumentStatus)
  signing_status: ReceivedDocumentStatus;

  @ApiProperty({
    description: 'UTC datetime of first access',
    nullable: true,
    example: null,
  })
  first_accessed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime of last access',
    nullable: true,
    example: null,
  })
  last_accessed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when I signed',
    nullable: true,
    example: null,
  })
  signed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when I rejected',
    nullable: true,
    example: null,
  })
  rejected_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when my access was revoked',
    nullable: true,
    example: null,
  })
  revoked_at: string | null;
}

export class ReceivedDocumentDetailDto {
  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  id: string;

  @ApiProperty({
    description: 'Document display name',
    example: 'NDA ACME',
  })
  document_name: string;

  @ApiProperty({
    description: 'Document description',
    nullable: true,
    example: null,
  })
  description: string | null;

  @ApiProperty({
    description: 'Document file size in bytes',
    example: 204800,
  })
  file_size_bytes: number;

  @ApiProperty({
    description: 'Original uploaded filename',
    example: 'nda_acme.pdf',
  })
  original_filename: string;

  @ApiProperty({
    description: 'Document MIME type',
    example: 'application/pdf',
  })
  mime_type: string;

  @ApiProperty({
    description: 'Document version number',
    example: 1,
  })
  version: number;

  @ApiProperty({
    enum: ReceivedDocumentStatus,
    description: 'My signature status',
    example: ReceivedDocumentStatus.PENDING,
  })
  @IsEnum(ReceivedDocumentStatus)
  status: ReceivedDocumentStatus;

  @ApiProperty({
    description: 'UTC datetime when the document was received',
    example: '2026-06-20T09:00:00.000Z',
  })
  received_at: string;

  @ApiProperty({
    description: 'UTC datetime when I signed',
    nullable: true,
    example: null,
  })
  signed_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when the document expires',
    nullable: true,
    example: null,
  })
  expires_at: string | null;

  @ApiProperty({
    description: 'UTC datetime when document record was created',
    example: '2026-06-20T08:50:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'UTC datetime when document record was last updated',
    example: '2026-06-20T09:00:00.000Z',
  })
  updated_at: string;

  @ApiProperty({ type: ReceivedDocumentSenderDto })
  sender: ReceivedDocumentSenderDto;

  @ApiProperty({ type: ReceivedDocumentMyRecipientDto })
  my_recipient: ReceivedDocumentMyRecipientDto;
}

export class ReceivedDocumentViewUrlDto {
  @ApiProperty({
    description: 'Secure URL to view the document',
    example: 'http://lsigner.com/public/abc123def456',
  })
  url: string;
}

export class RejectReceivedDocumentDto {
  @ApiPropertyOptional({
    description: 'Optional reason for rejection',
    example: 'I do not agree with the terms',
    maxLength: 1000,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

export class RejectReceivedDocumentResponseDto {
  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  id: string;

  @ApiProperty({
    description: 'Updated status',
    example: 'REJECTED',
  })
  status: string;

  @ApiProperty({
    description: 'UTC datetime when rejection occurred',
    example: '2026-06-22T09:00:00.000Z',
  })
  rejected_at: string;
}
