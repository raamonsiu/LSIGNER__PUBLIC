import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/normalize';
import { VerificationMethod } from './verification-method.enum';

export class SignSharedDocumentDto {
  @ApiPropertyOptional({
    description: 'Verification method completed before signing',
    enum: VerificationMethod,
    example: VerificationMethod.OTP,
  })
  @Transform(trim)
  @IsEnum(VerificationMethod)
  @IsOptional()
  verification_method?: VerificationMethod;

  @ApiPropertyOptional({
    description: 'Opaque verification reference produced by the auth flow',
    example: 'otp-session-2026-06-22-001',
    maxLength: 120,
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(120)
  verification_reference?: string;
}
