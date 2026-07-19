import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LockType } from '../../entities/document-lock.entity';

/**
 * Resolution status of a single recipient for a given lock.
 */
export class RecipientResolutionDto {
  @ApiProperty({
    description: 'DocumentRecipient UUID',
    example: 'b4cc290f-9cf0-4999-a023-bdf5f7654113',
  })
  recipient_id: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'alice@example.com',
  })
  recipient_email: string;

  @ApiPropertyOptional({
    description: 'Recipient display name (if provided)',
    example: 'Alice',
    nullable: true,
  })
  recipient_name: string | null;

  @ApiProperty({
    description: 'Whether this recipient has resolved the lock',
    example: true,
  })
  is_resolved: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp of resolution, null if not yet resolved',
    example: '2026-04-27T10:00:00.000Z',
    nullable: true,
  })
  resolved_at: Date | null;
}

/**
 * A lock on a document together with the resolution status for ALL recipients.
 *
 * Returned by "GET /documents/:id/locks" (owner-only overview).
 */
export class LockOverviewDto {
  @ApiProperty({
    description: 'Lock UUID',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  id: string;

  @ApiProperty({
    enum: LockType,
    description: 'Type of lock',
    example: LockType.PASSWORD,
  })
  lock_type: LockType;

  @ApiProperty({
    type: [RecipientResolutionDto],
    description: 'Resolution status for each recipient',
  })
  recipients: RecipientResolutionDto[];
}
