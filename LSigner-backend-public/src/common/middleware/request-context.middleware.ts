import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  AppRequest,
  RequestContext,
} from '../interfaces/request-context.interface';

/**
 * Assigns a unique `requestId` to every incoming request, honouring the
 * `X-Request-Id` header when provided (sanitised). The id and a typed
 * `RequestContext` object are attached to the request for downstream use.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  /**
   * Attach a lightweight typed `RequestContext` to every incoming request.
   * - honours `X-Request-Id` header if present, otherwise generates a UUID
   * - stores `requestId` on `req.id` and the full context on `req.context`
   * This middleware is intentionally minimal and does not perform auth.
   */
  use(req: Request, _res: Response, next: NextFunction): void {
    const appReq = req as unknown as AppRequest;

    // Honour caller-supplied id but sanitise to prevent log injection:
    // only allow alphanumerics and hyphens, max 64 chars.
    const rawId = req.headers['x-request-id'] as string | undefined;
    const requestId =
      rawId && /^[a-zA-Z0-9-]{1,64}$/.test(rawId) ? rawId : uuidv4();

    const context: RequestContext = {
      requestId,
      receivedAt: new Date().toISOString(),
    };

    appReq.id = requestId;
    appReq.context = context;

    next();
  }
}
