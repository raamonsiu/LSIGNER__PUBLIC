import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Removes the `file` key from req.body after multer has already extracted the
 * real file upload into req.file. This prevents the global ValidationPipe
 * (forbidNonWhitelisted: true) from rejecting an empty `file=` form field that
 * Swagger sends when no file is selected.
 *
 * Apply after `FileInterceptor` on any multipart endpoint where the DTO does
 * not declare a `file` field.
 */
@Injectable()
export class StripFileFromBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ body?: Record<string, unknown> }>();
    if (request.body && 'file' in request.body) {
      delete request.body['file'];
    }
    return next.handle();
  }
}
