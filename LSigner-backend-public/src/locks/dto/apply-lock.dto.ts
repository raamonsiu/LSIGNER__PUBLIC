import { IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LockType } from '../../entities/document-lock.entity';

/**
 * Describes a single lock to apply when sending a document.
 *
 * The "type" discriminant determines which fields are required.
 * Currently only PASSWORD is supported; future types will add their own
 * optional fields here without breaking existing consumers.
 */
export class ApplyLockDto {
  @ApiProperty({
    enum: LockType,
    description: 'Type of lock to apply',
    example: LockType.PASSWORD,
  })
  @IsEnum(LockType)
  type: LockType;

  @ApiPropertyOptional({
    description: 'Required when type is PASSWORD. Minimum 6 characters.',
    example: 'secret123',
    minLength: 6,
  })
  @ValidateIf((dto: ApplyLockDto) => dto.type === LockType.PASSWORD)
  @IsString()
  @MinLength(6)
  password?: string;
}
