import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AppRequest } from '../interfaces/request-context.interface';

/**
 * Logs the start and completion of every HTTP request including method, path,
 * status code, duration, and correlation ID (`requestId`).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /** Logger used for request lifecycle messages (correlation by requestId) */
  private readonly logger = new Logger('HTTP');

  /**
   * Intercepts every HTTP request to log start and end events.
   * Logs the `requestId` (from `RequestContextMiddleware`), method, path,
   * HTTP status and duration in milliseconds.
   * Does not modify the request or response.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AppRequest>();
    const response = httpContext.getResponse<Response>();
    const { method, url } = request;
    const requestId = request.id ?? 'unknown';
    const start = Date.now();

    this.logger.log(`[${requestId}] -> ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const { statusCode } = response;
          this.logger.log(
            `[${requestId}] <- ${method} ${url} ${statusCode} (${ms}ms)`,
          );
        },
        error: () => {
          const ms = Date.now() - start;
          const { statusCode } = response;
          const message = `[${requestId}] <- ${method} ${url} ${statusCode} (${ms}ms)`;
          if (statusCode >= 500) {
            this.logger.error(message);
          } else if (statusCode >= 400) {
            this.logger.warn(message);
          } else {
            this.logger.log(message);
          }
        },
      }),
    );
  }
}
