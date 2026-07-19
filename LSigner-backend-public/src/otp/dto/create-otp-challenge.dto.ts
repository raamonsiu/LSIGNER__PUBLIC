import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/utils/normalize';
import { OtpActionType } from '../enums/otp-action-type.enum';
import { OtpResourceType } from '../enums/otp-resource-type.enum';

export class CreateOtpChallengeDto {
  @ApiProperty({
    description: 'Action to authorise with OTP',
    enum: OtpActionType,
    example: OtpActionType.SIGN,
  })
  @Transform(trim)
  @IsEnum(OtpActionType)
  actionType: OtpActionType;

  @ApiProperty({
    description: 'Type of resource being acted upon',
    enum: OtpResourceType,
    example: OtpResourceType.DOCUMENT,
  })
  @Transform(trim)
  @IsEnum(OtpResourceType)
  resourceType: OtpResourceType;

  @ApiProperty({
    description: 'UUID of the resource (e.g. document ID)',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @ApiPropertyOptional({
    description: 'Optional reason for the action (e.g. rejection reason)',
    example: 'I need legal review before signing.',
    maxLength: 1000,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
