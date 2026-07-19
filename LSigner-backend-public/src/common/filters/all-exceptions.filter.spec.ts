import { INestApplication } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from './all-exceptions.filter';

// ── Minimal test controller ───────────────────────────────────────────────────

/**
 * Controller used exclusively in these tests to trigger specific HTTP errors.
 * Each handler throws the corresponding NestJS HttpException so the global
 * AllExceptionsFilter converts it to the normalized response shape.
 */
@Controller('test')
class TestController {
  @Get('400')
  throw400(): never {
    throw new BadRequestException('Invalid field value');
  }

  @Get('400-array')
  throw400Array(): never {
    throw new BadRequestException([
      'name must not be empty',
      'email must be valid',
    ]);
  }

  @Get('401')
  throw401(): never {
    throw new UnauthorizedException('Token expired');
  }

  @Get('403')
  throw403(): never {
    throw new ForbiddenException('Access denied');
  }

  @Get('404')
  throw404(): never {
    throw new NotFoundException('Resource not found');
  }

  @Get('409')
  throw409(): never {
    throw new ConflictException('Email already in use');
  }

  @Get('500')
  throw500(): never {
    throw new Error('Unexpected crash');
  }
}

// ── Shared matcher for common fields ─────────────────────────────────────────

/**
 * Returns a toMatchObject-compatible shape that all error responses must
 * include, regardless of status code.
 */
function baseErrorShape(statusCode: number, path: string) {
  return {
    statusCode,
    error: expect.any(String),
    message: expect.anything(),
    path,
    timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AllExceptionsFilter — error response shapes', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = module.createNestApplication();
    app.useLogger(false); // suppress NestJS logs (expected errors/warnings) in test output
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 400 Bad Request ────────────────────────────────────────────────────────

  describe('400 Bad Request', () => {
    it('has the correct shape with a single message string', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/400')
        .expect(400);

      expect(response.body).toMatchObject({
        ...baseErrorShape(400, '/test/400'),
        error: 'Bad Request',
        message: 'Invalid field value',
      });
    });

    it('has the correct shape with an array of validation messages', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/400-array')
        .expect(400);

      expect(response.body).toMatchObject({
        ...baseErrorShape(400, '/test/400-array'),
        error: 'Bad Request',
        message: ['name must not be empty', 'email must be valid'],
      });
    });
  });

  // ── 401 Unauthorized ───────────────────────────────────────────────────────

  describe('401 Unauthorized', () => {
    it('has the correct shape', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/401')
        .expect(401);

      expect(response.body).toMatchObject({
        ...baseErrorShape(401, '/test/401'),
        error: 'Unauthorized',
        message: 'Token expired',
      });
    });
  });

  // ── 403 Forbidden ──────────────────────────────────────────────────────────

  describe('403 Forbidden', () => {
    it('has the correct shape', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/403')
        .expect(403);

      expect(response.body).toMatchObject({
        ...baseErrorShape(403, '/test/403'),
        error: 'Forbidden',
        message: 'Access denied',
      });
    });
  });

  // ── 404 Not Found ─────────────────────────────────────────────────────────

  describe('404 Not Found', () => {
    it('has the correct shape', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/404')
        .expect(404);

      expect(response.body).toMatchObject({
        ...baseErrorShape(404, '/test/404'),
        error: 'Not Found',
        message: 'Resource not found',
      });
    });
  });

  // ── 409 Conflict ──────────────────────────────────────────────────────────

  describe('409 Conflict', () => {
    it('has the correct shape', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/409')
        .expect(409);

      expect(response.body).toMatchObject({
        ...baseErrorShape(409, '/test/409'),
        error: 'Conflict',
        message: 'Email already in use',
      });
    });
  });

  // ── 500 Internal Server Error ─────────────────────────────────────────────

  describe('500 Internal Server Error', () => {
    it('has the correct shape for unexpected errors', async () => {
      const response: { body: Record<string, unknown> } = await request(
        app.getHttpServer(),
      )
        .get('/test/500')
        .expect(500);

      expect(response.body).toMatchObject({
        ...baseErrorShape(500, '/test/500'),
        statusCode: 500,
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });
  });

  // ── No extra fields ───────────────────────────────────────────────────────

  it('does not include unexpected fields in the response', async () => {
    const response: { body: Record<string, unknown> } = await request(
      app.getHttpServer(),
    )
      .get('/test/404')
      .expect(404);

    const allowedKeys = new Set([
      'statusCode',
      'error',
      'message',
      'path',
      'timestamp',
      'requestId',
    ]);
    const extraKeys = Object.keys(response.body).filter(
      (key) => !allowedKeys.has(key),
    );
    expect(extraKeys).toHaveLength(0);
  });
});
