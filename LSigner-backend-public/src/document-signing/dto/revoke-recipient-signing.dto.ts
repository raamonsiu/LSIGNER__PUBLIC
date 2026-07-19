import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/normalize';

export class RevokeRecipientSigningDto {
  @ApiPropertyOptional({
    description: 'Reason captured by the owner while revoking recipient access',
    example: 'Recipient changed, revoking previous invitation.',
    maxLength: 1000,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
