import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Account password (minimum 8 characters)',
    example: 'Str0ngP@ssword!',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
