import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithPublicSession } from '../public-session.types';

export const CurrentPublicSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithPublicSession>();
    return request.publicSession;
  },
);
