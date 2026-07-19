import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/normalize';
import { VerificationMethod } from './verification-method.enum';

export class RevokeSharedDocumentDto {
  @ApiPropertyOptional({
    description: 'Verification method used to authorize revocation',
    enum: VerificationMethod,
    example: VerificationMethod.OTP,
    default: VerificationMethod.OTP,
  })
  @Transform(trim)
  @IsEnum(VerificationMethod)
  verification_method: VerificationMethod = VerificationMethod.OTP;

  @ApiPropertyOptional({
    description: 'Verification reference or OTP session id',
    example: 'otp-session-2026-06-22-001',
    maxLength: 120,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(120)
  verification_reference?: string;

  @ApiPropertyOptional({
    description: 'Optional reason provided by the recipient for revocation',
    example: 'I revoke my previous signature.',
    maxLength: 1000,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
