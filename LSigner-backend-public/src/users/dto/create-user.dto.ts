import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/utils/normalize';

export class CreateUserDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Doe Smith',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  last_name: string;

  @ApiProperty({
    description: 'Country of the user',
    example: 'Spain',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

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

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @Transform(trim)
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'Phone number of the user in E.164 international format (e.g. +34600000000). The API normalises input to E.164 before storing.',
    example: '+34600000000',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone_number: string;

  @ApiProperty({
    description: 'Password of the user',
    example: 'password123',
    minLength: 8,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
