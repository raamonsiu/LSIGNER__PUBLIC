import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithPublicSession } from '../public-session.types';
import { PublicSessionService } from '../public-session.service';
import { extractCookieValue } from '../../common/utils/cookie';

const PUBLIC_SESSION_COOKIE_NAME = 'ls_public_session';

@Injectable()
export class PublicSessionGuard implements CanActivate {
  constructor(private readonly publicSessionService: PublicSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithPublicSession>();
    const cookieHeader = request.headers.cookie;
    const sessionToken = extractCookieValue(
      cookieHeader,
      PUBLIC_SESSION_COOKIE_NAME,
    );

    if (!sessionToken) {
      throw new ForbiddenException('Public session required');
    }

    request.publicSession =
      await this.publicSessionService.resolvePublicSession(sessionToken);

    return true;
  }
}

export { PUBLIC_SESSION_COOKIE_NAME };
