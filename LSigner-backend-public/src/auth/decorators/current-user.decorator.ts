import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Shape of the JWT access-token payload stored on the request object. */
export interface JwtPayload {
  /** Patient UUID (`patient_id` in the DB). */
  sub: string;
  email: string;
  iat?: number; // Issued AT
  exp?: number; // EXPiration
}

/**
 * Parameter decorator that extracts the authenticated user's JWT payload from
 * the incoming request. Only valid on routes protected by `JwtAuthGuard`.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return { id: user.sub, email: user.email };
 * }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
