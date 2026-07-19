import { ApiProperty } from '@nestjs/swagger';

export class OtpChallengeResponseDto {
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
    description:
      'ISO timestamp when the next resend is allowed (null if not applicable)',
    example: '2026-06-22T12:30:30.000Z',
    nullable: true,
  })
  resendAvailableAt: string | null;

  @ApiProperty({
    description: 'Masked destination where the OTP was sent',
    example: 'j***@mail.com',
  })
  maskedDestination: string;

  @ApiProperty({
    description: 'Remaining attempts before the challenge is locked',
    example: 5,
  })
  remainingAttempts: number;

  @ApiProperty({
    description: 'Remaining resends allowed',
    example: 3,
  })
  remainingResends: number;
}
