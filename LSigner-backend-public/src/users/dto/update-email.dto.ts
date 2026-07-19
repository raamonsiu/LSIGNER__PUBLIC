import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class UpdateEmailDto {
  @ApiProperty({
    description:
      'New email address to replace the current one. Must be unique across all users. ' +
      'Email is treated as a natural key, so this endpoint updates it atomically across ' +
      'all related records.',
    example: 'new.email@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  new_email: string;
}
