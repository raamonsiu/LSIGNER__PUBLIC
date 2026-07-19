import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/utils/normalize';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'First name of the user',
    example: 'John',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Doe Smith',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(200)
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Country of the user',
    example: 'Spain',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'National ID of the user',
    example: '12345678A',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(50)
  national_id?: string;

  @ApiPropertyOptional({
    description: 'Passport number of the user',
    example: 'AB123456',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(50)
  passport?: string;

  @ApiPropertyOptional({
    description:
      'Phone number of the user in E.164 international format (e.g. +34600000000). The API normalises input to E.164 before storing.',
    example: '+34600000000',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Password of the user',
    example: 'password123',
    minLength: 8,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    description:
      'New email address. Requires current_password when provided alongside other sensitive fields.',
    example: 'new.email@example.com',
  })
  @Transform(trim)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Current password — required when changing email, phone_number, or password.',
    example: 'myCurrentPassword123',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  current_password?: string;

  @ApiPropertyOptional({
    description:
      'New password (min 8 characters). Requires current_password and confirm_new_password.',
    example: 'myNewPassword456',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  new_password?: string;

  @ApiPropertyOptional({
    description: 'Must match new_password.',
    example: 'myNewPassword456',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  confirm_new_password?: string;
}
