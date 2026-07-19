import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { isProduction } from './config/is-production';

/**
 * Bootstraps the NestJS application: registers global filters, pipes,
 * interceptors and Swagger, then starts listening on the configured port.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // CORS : allow frontend origin in development; use configured origins in production
  const isProductionResult = isProduction(
    process.env.APP_ENV,
    process.env.NODE_ENV,
  );
  const corsOrigins = isProductionResult
    ? (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

  if (isProductionResult && corsOrigins.length === 0) {
    logger.warn(
      'CORS_ORIGINS is empty in production : all cross-origin requests will be blocked',
    );
  }

  app.enableCors({
    origin: isProductionResult ? corsOrigins : true,
    credentials: true,
  });

  // Global exception filter — consistent JSON error shape
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe — validate & transform DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global logging interceptor — request start/end + timing
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LSigner API')
    .setDescription('REST API for the LSigner document-signing platform')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  app.enableShutdownHooks();

  const configuredPort = app.get(ConfigService).get<number>('app.port');
  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = configuredPort ?? envPort ?? 3000;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`Swagger UI available at http://localhost:${port}/docs`);
}
void bootstrap();
