import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root(): string {
    return 'Hello World!';
  }

  @Public()
  @Get('health')
  health(): string {
    return 'OK';
  }
}
