import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PurgeCronService } from './purge-cron.service';
import { PurgeService } from './purge.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PurgeService, PurgeCronService],
  exports: [PurgeService],
})
export class PurgeModule {}
