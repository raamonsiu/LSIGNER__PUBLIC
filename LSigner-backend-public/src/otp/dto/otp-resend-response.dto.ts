import { ApiProperty } from '@nestjs/swagger';

export class OtpResendResponseDto {
  @ApiProperty({
    description: 'OTP challenge UUID',
    example: '9e13af0a-f808-47e6-9e7f-7403eb5ee032',
  })
  challengeId: string;

  @ApiProperty({
    description: 'ISO timestamp when the OTP expires',
    example: '2026-06-22T12:34:56.000Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'ISO timestamp when the next resend is allowed',
    example: '2026-06-22T12:31:30.000Z',
  })
  resendAvailableAt: string;

  @ApiProperty({
    description: 'Remaining resends allowed',
    example: 2,
  })
  remainingResends: number;
}
