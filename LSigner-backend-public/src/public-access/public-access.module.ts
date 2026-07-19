import { Module } from '@nestjs/common';
import { PublicSessionService } from './public-session.service';
import { PublicSessionController } from './public-session.controller';

@Module({
  controllers: [PublicSessionController],
  providers: [PublicSessionService],
  exports: [PublicSessionService],
})
export class PublicAccessModule {}
