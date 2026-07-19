import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      // useFactory builds the module config dynamically at runtime (instead of
      // a static object) so it can read JWT_SECRET from ConfigService and
      // validate it before the app finishes starting.
      useFactory: (config: ConfigService) => {
        const jwtSecret = config.get<string>('auth.jwtSecret');

        if (!jwtSecret || jwtSecret.trim().length === 0) {
          throw new Error(
            "Invalid auth configuration: 'auth.jwtSecret' is required. " +
              'Set the JWT_SECRET environment variable before starting the application.',
          );
        }

        return { secret: jwtSecret };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard, AuthService],
})
export class AuthModule {}
