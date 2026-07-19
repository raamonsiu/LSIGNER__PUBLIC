import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './../src/common/interceptors/logging.interceptor';

/**
 * E2E tests for the OTP module.
 *
 * These tests require a running PostgreSQL instance configured via env vars.
 * Run with: npm run test:e2e
 */
describe('OTP (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let accessToken: string;
  let testUserId: string;
  let testUserEmail: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const configService = app.get(ConfigService);
    const corsOrigins = configService.get<string[]>('app.corsOrigins')!;
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: [],
      credentials: true,
      maxAge: 600,
    });

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.init();
    httpServer = app.getHttpServer();

    // Create a test user and obtain auth token for OTP endpoints
    testUserEmail = `e2e-otp-${Date.now()}@example.com`;
    const testPassword = 'E2eOtpPass123!';
    const testPhone = `+34700${Date.now().toString().slice(-6)}`;

    const createRes = await request(httpServer)
      .post('/users')
      .send({
        name: 'OTP',
        last_name: 'E2E',
        country: 'Spain',
        email: testUserEmail,
        phone_number: testPhone,
        password: testPassword,
      })
      .expect(201);
    testUserId = (createRes.body as { patient_id: string }).patient_id;

    const loginRes = await request(httpServer)
      .post('/auth/login')
      .send({ email: testUserEmail, password: testPassword })
      .expect(200);
    accessToken = (loginRes.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    if (testUserId && accessToken) {
      await request(httpServer)
        .delete(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    }

    await app.close();
  });

  // ── Health check ───────────────────────────────────────────────────────────

  it('/v1/otp/challenges returns 401/403 without auth', () => {
    return request(httpServer)
      .post('/v1/otp/challenges')
      .send({
        actionType: 'SIGN',
        resourceType: 'DOCUMENT',
        resourceId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(401);
  });

  it('/v1/otp/challenges/:id/verify returns 403 for non-existent challenge', () => {
    return request(httpServer)
      .post('/v1/otp/challenges/00000000-0000-0000-0000-000000000000/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '123456' })
      .expect(403);
  });

  it('/v1/otp/challenges/:id/resend returns 403 for non-existent challenge', () => {
    return request(httpServer)
      .post('/v1/otp/challenges/00000000-0000-0000-0000-000000000000/resend')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(403);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('POST /v1/otp/challenges validates actionType', () => {
    return request(httpServer)
      .post('/v1/otp/challenges')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        actionType: 'INVALID',
        resourceType: 'DOCUMENT',
        resourceId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(400);
  });

  it('POST /v1/otp/challenges validates resourceType', () => {
    return request(httpServer)
      .post('/v1/otp/challenges')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        actionType: 'SIGN',
        resourceType: 'INVALID',
        resourceId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(400);
  });

  it('POST /v1/otp/challenges validates resourceId is not empty', () => {
    return request(httpServer)
      .post('/v1/otp/challenges')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        actionType: 'SIGN',
        resourceType: 'DOCUMENT',
        resourceId: '',
      })
      .expect(400);
  });

  it('POST /v1/otp/challenges/:id/verify validates code length', () => {
    return request(httpServer)
      .post('/v1/otp/challenges/00000000-0000-0000-0000-000000000000/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '123' })
      .expect(400);
  });

  it('POST /v1/otp/challenges/:id/verify validates code is not empty', () => {
    return request(httpServer)
      .post('/v1/otp/challenges/00000000-0000-0000-0000-000000000000/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '' })
      .expect(400);
  });
});
