import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'One-time password code',
    example: '123456',
    minLength: 4,
    maxLength: 8,
  })
  @IsString()
  @Length(4, 8)
  code: string;
}
