/**
 * Dev-only endpoints for the frontend integration test suite
 * ("client.integration.test.ts" in LSigner-frontend).
 *
 * Registered ONLY when "(APP_ENV ?? NODE_ENV) !== 'production'" (see "AppModule").
 * In production ("env === 'production'"), every "/test/*" route returns 404.
 *
 * None touch the database: they echo input, throw controlled errors,
 * or add artificial delay.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('test')
export class TestController {
  @Public()
  @Get('echo')
  echoGet(@Query() query: Record<string, unknown>) {
    return query;
  }

  @Public()
  @Post('echo')
  echoPost(@Body() body: unknown) {
    return body;
  }

  @Public()
  @Post('echo-headers')
  echoHeaders(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const header = (name: string) => {
      const value = headers[name];
      return Array.isArray(value) ? value.join(', ') : (value ?? null);
    };

    return {
      'content-type': header('content-type'),
      accept: header('accept'),
      authorization: header('authorization'),
      'x-request-id': header('x-request-id'),
      'x-custom': header('x-custom'),
    };
  }

  @Public()
  @Get('status/:code')
  status(
    @Param('code', ParseIntPipe) code: number,
    @Query('type') type?: string,
  ) {
    if (type === 'validation') {
      throw new UnprocessableEntityException({
        message: ['field1 is required', 'field2 must be a string'],
        error: 'Unprocessable Entity',
      });
    }
    if (code < 400 || code > 599) {
      throw new BadRequestException('Status code must be 4xx or 5xx');
    }
    throw new HttpException('Test error', code);
  }

  @Public()
  @Get('delay/:ms')
  async delay(@Param('ms', ParseIntPipe) ms: number) {
    if (ms < 0 || ms > 30_000) {
      throw new BadRequestException('Delay must be between 0 and 30000 ms');
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { delayed: true, ms };
  }

  @Get('protected')
  getProtected(@CurrentUser() user: JwtPayload) {
    return { userId: user.sub, email: user.email };
  }
}
