import { ApiProperty } from '@nestjs/swagger';

export class VerifyPasswordResponseDto {
  @ApiProperty({
    description: 'Whether the password matches the stored hash',
    example: true,
  })
  verified: boolean;
}
