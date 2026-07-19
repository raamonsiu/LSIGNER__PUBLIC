import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import emailConfig from './config/email.config';
import otpConfig from './config/otp.config';
import signingConfig from './config/signing.config';
import { AppController } from './app.controller';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { TestController } from './test/test.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ContactsModule } from './contacts/contacts.module';
import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { PublicAccessModule } from './public-access/public-access.module';
import { PurgeModule } from './purge/purge.module';

// Environment file loading policy:
// Precedence (first wins):
// 1. .env.local         (local overrides, should be gitignored)
// 2. .env.<env>         (environment-specific, e.g. .env.test)
// 3. .env               (base defaults)
// In production prefer real env vars; set NODE_ENV=production and
// `ignoreEnvFile` will be enabled to avoid reading files.
const env = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';
const envFile = `.env.${env}`;
const envFilePaths = isProd
  ? [envFile, '.env']
  : ['.env.local', envFile, '.env'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths,
      ignoreEnvFile: isProd,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        emailConfig,
        otpConfig,
        signingConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const ssl = config.get<false | { rejectUnauthorized: boolean }>(
          'database.ssl',
        );

        return {
          type: 'postgres',
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.database'),
          ssl,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          synchronize: config.get<boolean>('database.synchronize'),
          logging: config.get<boolean>('database.logging'),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    ContactsModule,
    DocumentsModule,
    EmailModule,
    UsersModule,
    OtpModule,
    PublicAccessModule,
    PurgeModule,
  ],
  // TestController is dev-only — never expose /test/* in production.
  controllers: [AppController, ...(isProd ? [] : [TestController])],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
