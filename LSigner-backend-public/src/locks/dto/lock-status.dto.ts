import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LockType } from '../../entities/document-lock.entity';

/**
 * Represents a lock on a document together with its resolution status
 * for the requesting user.
 *
 * Returned by "GET /documents/:id/locks".
 */
export class LockStatusDto {
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
    description:
      'Whether the requesting user has already resolved this lock. ' +
      'Always false for the document owner (owners bypass lock checks).',
    example: false,
  })
  is_resolved: boolean;

  @ApiPropertyOptional({
    description:
      'Timestamp at which the lock was resolved. Null if not yet resolved.',
    example: '2026-04-27T10:00:00.000Z',
    nullable: true,
  })
  resolved_at: Date | null;
}
