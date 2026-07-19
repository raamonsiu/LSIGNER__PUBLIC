/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './../src/common/interceptors/logging.interceptor';
import {
  createTestUser,
  loginUser,
  cleanupUsers,
  type TestUser,
} from './utils/e2e-helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  let testUser: TestUser;

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

    // Create a single test user for all auth tests
    testUser = await createTestUser(app);
  });

  afterAll(async () => {
    if (testUser) {
      await cleanupUsers(app, [
        {
          userId: testUser.user.patient_id,
          accessToken: testUser.accessToken,
        },
      ]);
    }
    await app.close();
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const validEmail = () => testUser.user.email;
    const correctPassword = () => testUser.password;

    it('returns 200 with access_token and refresh_token for valid credentials', async () => {
      const res = await request(httpServer)
        .post('/auth/login')
        .send({ email: validEmail(), password: correctPassword() })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body).toHaveProperty('expires_in');
      expect(typeof res.body.access_token).toBe('string');
      expect(typeof res.body.refresh_token).toBe('string');
      expect(typeof res.body.expires_in).toBe('number');
      expect(res.body.access_token.length).toBeGreaterThan(10);
      expect(res.body.refresh_token.length).toBeGreaterThan(10);
      expect(res.body.expires_in).toBeGreaterThan(0);
    });

    it('returns 401 for wrong password', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: validEmail(), password: 'WrongPassword123!' })
        .expect(401);
    });

    it('returns 401 for non-existent email', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({
          email: `nonexistent-${Date.now()}@example.com`,
          password: 'DoesNotMatter123!',
        })
        .expect(401);
    });

    it('returns 400 when email field is missing', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ password: 'SomePassword123!' })
        .expect(400);
    });

    it('returns 400 when password field is missing', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: validEmail() })
        .expect(400);
    });
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 200 with new token pair for valid refresh token', async () => {
      const res = await request(httpServer)
        .post('/auth/refresh')
        .send({ refresh_token: testUser.refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body).toHaveProperty('expires_in');
      // refresh_token MUST rotate (single-use); access_token may match if
      // issued within the same second (JWT iat is second-granular).
      expect(res.body.refresh_token).not.toBe(testUser.refreshToken);

      // Update stored tokens so teardown uses valid credentials
      testUser.accessToken = res.body.access_token as string;
      testUser.refreshToken = res.body.refresh_token as string;
    });

    it('returns 401 when reusing a rotated (already-consumed) refresh token', async () => {
      // Login fresh to get a clean refresh token
      const fresh = await loginUser(
        app,
        testUser.user.email,
        testUser.password,
      );

      // Consume it once
      const first = await request(httpServer)
        .post('/auth/refresh')
        .send({ refresh_token: fresh.refreshToken })
        .expect(200);

      // Reusing the SAME token must return 401 (rotation enforcement)
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refresh_token: fresh.refreshToken })
        .expect(401);

      // Update testUser with the valid rotated tokens
      testUser.accessToken = first.body.access_token as string;
      testUser.refreshToken = first.body.refresh_token as string;
    });

    it('returns 401 for a completely invalid (random) refresh token', async () => {
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-refresh-token-that-does-not-exist' })
        .expect(401);
    });

    it('returns 400 when refresh_token field is missing', async () => {
      await request(httpServer).post('/auth/refresh').send({}).expect(400);
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 204 and invalidates refresh token for authenticated user', async () => {
      // Login fresh for a known refresh token
      const fresh = await loginUser(
        app,
        testUser.user.email,
        testUser.password,
      );

      // Logout
      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${fresh.accessToken}`)
        .send({ refresh_token: fresh.refreshToken })
        .expect(204);

      // The refresh token should now be invalidated
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refresh_token: fresh.refreshToken })
        .expect(401);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .post('/auth/logout')
        .send({ refresh_token: 'some-token' })
        .expect(401);
    });
  });

  // ── Verify Password ────────────────────────────────────────────────────────

  describe('POST /auth/verify-password', () => {
    it('returns 200 with verified=true for correct password', async () => {
      const res = await request(httpServer)
        .post('/auth/verify-password')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ password: testUser.password })
        .expect(200);

      expect(res.body).toEqual({ verified: true });
    });

    it('returns 401 for wrong password', async () => {
      await request(httpServer)
        .post('/auth/verify-password')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({ password: 'WrongPassword123!' })
        .expect(401);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .post('/auth/verify-password')
        .send({ password: testUser.password })
        .expect(401);
    });
  });
});
