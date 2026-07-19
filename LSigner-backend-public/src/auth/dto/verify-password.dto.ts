import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPasswordDto {
  @ApiProperty({
    description: 'Current account password to verify',
    example: 'Str0ngP@ssword!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
