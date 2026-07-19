import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { OtpPublicController } from './otp-public.controller';
import { DocumentSigningModule } from '../document-signing/document-signing.module';
import { PublicAccessModule } from '../public-access/public-access.module';

@Module({
  imports: [DocumentSigningModule, PublicAccessModule],
  controllers: [OtpController, OtpPublicController],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
