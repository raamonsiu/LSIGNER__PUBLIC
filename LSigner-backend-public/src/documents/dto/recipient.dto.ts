import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/utils/normalize';

export class RecipientDto {
  @ApiProperty({
    description:
      'Email address of the recipient. Used as unique identifier per document.',
    example: 'recipient@example.com',
  })
  @Transform(trim)
  @IsEmail()
  @IsNotEmpty()
  recipient_email: string;

  @ApiPropertyOptional({
    description:
      'Display name of the recipient (useful when the recipient is not registered)',
    example: 'Jane Smith',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(200)
  recipient_name?: string;

  @ApiPropertyOptional({
    description:
      'UUID of a registered user. When provided, the document appears in their received documents list.',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  @IsUUID()
  @IsOptional()
  user_id?: string;
}
