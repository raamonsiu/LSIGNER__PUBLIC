import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActionResultDto {
  @ApiProperty({
    description: 'Type of resource acted upon',
    example: 'DOCUMENT',
  })
  resourceType: string;

  @ApiProperty({
    description: 'UUID of the resource',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  resourceId: string;

  @ApiProperty({
    description: 'New status of the resource after the action',
    example: 'SIGNED',
  })
  newStatus: string;

  @ApiPropertyOptional({
    description: 'Additional result metadata (e.g. signed artifact ID)',
    example: { artifactId: '9e13af0a-f808-47e6-9e7f-7403eb5ee032' },
  })
  metadata?: Record<string, unknown>;
}

export class OtpVerifyResponseDto {
  @ApiProperty({
    description: 'Whether the OTP was successfully verified',
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: 'Result of the authorised action',
    type: ActionResultDto,
  })
  actionResult: ActionResultDto;
}
