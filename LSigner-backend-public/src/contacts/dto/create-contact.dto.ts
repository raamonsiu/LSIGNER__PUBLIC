import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/utils/normalize';

/**
 * E.164 phone number pattern: starts with '+' followed by 7–15 digits.
 */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export class CreateContactDto {
  @ApiProperty({
    description: 'Email address of the contact',
    example: 'alice@example.com',
  })
  @Transform(trim)
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  contact_email: string;

  @ApiPropertyOptional({
    description: 'Display name for the contact',
    example: 'Alice Example',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(200)
  contact_name?: string;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format (e.g. +34600000000)',
    example: '+34600000000',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @Matches(E164_PATTERN, {
    message:
      'contact_phone must be a valid E.164 phone number (e.g. +34600000000)',
  })
  @MaxLength(30)
  contact_phone?: string;

  @ApiPropertyOptional({
    description: 'UUID of the registered user this contact represents',
    example: 'b4cc290f-9ca0-4999-0023-bdf5f7654113',
  })
  @IsUUID('4')
  @IsOptional()
  contact_user_id?: string;
}
