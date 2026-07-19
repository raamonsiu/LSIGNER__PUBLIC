/**
 * This file defines DTOs for standard API error responses, following a consistent structure for all error types. These DTOs are used in Swagger documentation to illustrate the format of error responses returned by the API.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ! 400 Bad Request : validation errors produced by the global ValidationPipe.
 *
 * ```json
 * {
 *   "statusCode": 400,
 *   "error": "Bad Request",
 *   "message": ["email must be an email", "password should not be empty"],
 *   "path": "/users",
 *   "timestamp": "2026-05-28T10:00:00.000Z"
 * }
 * ```
 */
export class ApiBadRequestErrorDto {
  @ApiProperty({ description: 'HTTP status code', example: 400, default: 400 })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Bad Request',
    default: 'Bad Request',
  })
  error!: string;

  @ApiProperty({
    description:
      'Array of validation error messages produced by the ValidationPipe, ' +
      'or a single string when the rejection is not field-level.',
    oneOf: [
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email', 'password should not be empty'],
      },
      { type: 'string', example: 'Missing required file' },
    ],
  })
  message!: string | string[];

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/users',
    default: '/users',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-05-28T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 401 Unauthorized : missing, expired or invalid JWT / refresh token.
 *
 * ```json
 * {
 *   "statusCode": 401,
 *   "error": "Unauthorized",
 *   "message": "Token is not provided",
 *   "path": "/documents",
 *   "timestamp": "2026-05-28T10:00:00.000Z"
 * }
 * ```
 */
export class ApiUnauthorizedErrorDto {
  @ApiProperty({ description: 'HTTP status code', example: 401, default: 401 })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Unauthorized',
    default: 'Unauthorized',
  })
  error!: string;

  @ApiProperty({
    description: 'Reason why the request is not authenticated',
    example: 'Token is not provided',
    default: 'Token is not provided',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/documents',
    default: '/documents',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-05-28T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 403 Forbidden : authenticated but not authorised to access the resource.
 *
 * ```json
 * {
 *   "statusCode": 403,
 *   "error": "Forbidden",
 *   "message": "You are not the owner of this document",
 *   "path": "/documents/uuid/send",
 *   "timestamp": "2026-05-28T10:00:00.000Z"
 * }
 * ```
 */
export class ApiForbiddenErrorDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 403,
    default: 403,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Forbidden',
    default: 'Forbidden',
  })
  error!: string;

  @ApiProperty({
    description: 'Reason why access is denied',
    example: 'You are not the owner of this document',
    default: 'You are not the owner of this document',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-05-28T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 404 Not Found : the requested resource does not exist.
 *
 * ```json
 * {
 *   "statusCode": 404,
 *   "error": "Not Found",
 *   "message": "Document a3bb189e not found",
 *   "path": "/documents/a3bb189e",
 *   "timestamp": "2026-05-28T10:00:00.000Z"
 * }
 * ```
 */
export class ApiNotFoundErrorDto {
  @ApiProperty({ description: 'HTTP status code', example: 404, default: 404 })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Not Found',
    default: 'Not Found',
  })
  error!: string;

  @ApiProperty({
    description: 'Description of which resource was not found',
    example: 'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-05-28T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 409 Conflict : the operation conflicts with existing state.
 *
 * ```json
 * {
 *   "statusCode": 409,
 *   "error": "Conflict",
 *   "message": "Email already in use",
 *   "path": "/users",
 *   "timestamp": "2026-05-28T10:00:00.000Z"
 * }
 * ```
 */
export class ApiConflictErrorDto {
  @ApiProperty({ description: 'HTTP status code', example: 409, default: 409 })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Conflict',
    default: 'Conflict',
  })
  error!: string;

  @ApiProperty({
    description: 'Description of the conflict',
    example: 'Email already in use',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/users',
    default: '/users',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-05-28T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 410 Gone : the requested resource is no longer available (e.g. expired OTP).
 *
 * ```json
 * {
 *   "statusCode": 410,
 *   "error": "Gone",
 *   "message": "OTP has expired",
 *   "path": "/v1/otp/challenges/uuid/verify",
 *   "timestamp": "2026-06-22T10:00:00.000Z"
 * }
 * ```
 */
export class ApiGoneErrorDto {
  @ApiProperty({ description: 'HTTP status code', example: 410, default: 410 })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Gone',
    default: 'Gone',
  })
  error!: string;

  @ApiProperty({
    description: 'Description of what is no longer available',
    example: 'OTP has expired',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/v1/otp/challenges/uuid/verify',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-06-22T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 422 Unprocessable Entity : request body is valid but the server cannot process it (e.g. invalid OTP code).
 *
 * ```json
 * {
 *   "statusCode": 422,
 *   "error": "Unprocessable Entity",
 *   "message": "Invalid OTP. 4 attempts remaining.",
 *   "path": "/v1/otp/challenges/uuid/verify",
 *   "timestamp": "2026-06-22T10:00:00.000Z"
 * }
 * ```
 */
export class ApiUnprocessableEntityErrorDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 422,
    default: 422,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Unprocessable Entity',
    default: 'Unprocessable Entity',
  })
  error!: string;

  @ApiProperty({
    description: 'Description of what was rejected and why',
    example: 'Invalid OTP. 4 attempts remaining.',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/v1/otp/challenges/uuid/verify',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-06-22T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 429 Too Many Requests : rate limit exceeded.
 *
 * ```json
 * {
 *   "statusCode": 429,
 *   "error": "Too Many Requests",
 *   "message": "Too many requests. Please try again later.",
 *   "path": "/v1/otp/challenges",
 *   "timestamp": "2026-06-22T10:00:00.000Z"
 * }
 * ```
 */
export class ApiTooManyRequestsErrorDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 429,
    default: 429,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Too Many Requests',
    default: 'Too Many Requests',
  })
  error!: string;

  @ApiProperty({
    description: 'Rate limit exceeded message',
    example: 'Too many requests. Please try again later.',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/v1/otp/challenges',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-06-22T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}

/**
 * ! 500 Internal Server Error : unexpected failure, safe to retry later.
 *
 * ```json
 * {
 *   "statusCode": 500,
 *   "error": "Internal Server Error",
 *   "message": "Oops! Something went wrong, please try again later",
 *   "path": "/documents",
 *   "timestamp": "2026-05-28T10:00:00.000Z"
 * }
 * ```
 */
export class ApiInternalServerErrorDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 500,
    default: 500,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Short error type',
    example: 'Internal Server Error',
    default: 'Internal Server Error',
  })
  error!: string;

  @ApiProperty({
    description: 'Generic message : details are logged server-side only',
    example: 'Oops! Something went wrong, please try again later',
    default: 'Oops! Something went wrong, please try again later',
  })
  message!: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/documents',
  })
  path!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp',
    example: '2026-05-28T10:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Correlation request ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId?: string;
}
