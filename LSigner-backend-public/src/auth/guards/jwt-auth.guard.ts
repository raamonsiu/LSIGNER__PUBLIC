import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

/**
 * Global guard that enforces JWT authentication on all routes by default.
 *
 * Routes decorated with `@Public()` are exempt and do not require a token.
 * On success the decoded JWT payload is attached to `request.user` so it can
 * be retrieved with the `@CurrentUser()` parameter decorator.
 *
 * For authenticated (non-public) routes, the guard also verifies that the
 * user account has not been soft-deleted. Deleted users are rejected with 401
 * to prevent any further API access after account deletion.
 *
 * Registered as `APP_GUARD` in `AppModule` so it applies project-wide without
 * explicit `@UseGuards()` annotations per controller.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    const token = this.extractBearerToken(request);

    // On @Public() routes, the JWT is optional : extract it if present
    // but never throw. On non-public routes a valid token is mandatory.
    if (isPublic) {
      if (token) {
        try {
          request.user = this.jwtService.verify<JwtPayload>(token);
        } catch {
          // Ignore invalid tokens on public routes
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    let payload: JwtPayload;
    try {
      // JwtService was configured with the JWT_SECRET at module level
      payload = this.jwtService.verify<JwtPayload>(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Verify the user has not been soft-deleted
    const user = await this.entityManager.findOne(User, {
      where: { patient_id: payload.sub },
      select: ['patient_id', 'deleted_at'],
    });

    if (!user || user.deleted_at) {
      throw new UnauthorizedException('Deleted account');
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
