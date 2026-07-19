import { ApiProperty } from '@nestjs/swagger';

export class TokensResponseDto {
  @ApiProperty({
    description:
      'Short-lived JWT access token — include as `Authorization: Bearer <token>`',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description:
      'Single-use opaque refresh token. Use POST /auth/refresh to obtain a new access token.',
    example: 'a1b2c3d4e5f6...',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 900,
  })
  expires_in: number;
}
