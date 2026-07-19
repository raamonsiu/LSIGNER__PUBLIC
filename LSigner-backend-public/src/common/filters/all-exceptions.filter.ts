import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppRequest } from '../interfaces/request-context.interface';

/**
 * Standard shape returned by the global exception filter.
 * Keeps error responses consistent across the API.
 */
interface ErrorResponse {
  /** HTTP status code (e.g. 404, 500) */
  statusCode: number;
  /** Short textual error (e.g. "Not Found", "Bad Request") */
  error: string;
  /** Error message or array of validation messages */
  message: string | string[];
  /** Request path that produced the error */
  path: string;
  /** ISO timestamp when the error was produced */
  timestamp: string;
  /** Optional correlation id assigned to the request */
  requestId?: string;
}

/**
 * Catches all exceptions thrown in the HTTP flow and converts them
 * into a consistent JSON response. Also performs conditional logging:
 * - 5xx errors are logged as errors (with stack)
 * - 4xx errors are logged as warnings
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * Handle any exception and send a normalized JSON payload.
   * @param exception The thrown value (HttpException or unknown)
   * @param host Execution context (used to access request/response)
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    // Derive HTTP status (use HttpException status when available)
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const exceptionResponseFullObject = exceptionResponse as Record<
          string,
          unknown
        >;
        message =
          (exceptionResponseFullObject['message'] as string | string[]) ??
          message;
        error =
          (exceptionResponseFullObject['error'] as string) ??
          HttpStatus[statusCode];
      }
      error = error || HttpStatus[statusCode];
    }

    // Normalized response body sent to clients
    const body: ErrorResponse = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: (request as unknown as AppRequest).id,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${statusCode}: ${String(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }
}
