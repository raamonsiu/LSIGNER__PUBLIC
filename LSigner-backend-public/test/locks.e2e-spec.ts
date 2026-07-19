/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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
  createTestDocument,
  cleanupUsers,
  type TestUser,
  type TestDocument,
} from './utils/e2e-helpers';

describe('Locks (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  let owner: TestUser;
  let recipient: TestUser;
  let docWithLocks: TestDocument;
  let lockId: string;

  // ── Setup / Teardown ────────────────────────────────────────────────────────

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

    // ── Create test users ──────────────────────────────────────────────────
    owner = await createTestUser(app);
    recipient = await createTestUser(app);

    // ── Owner creates a document and sends it to recipient with a PASSWORD lock
    const doc = await createTestDocument(app, owner.accessToken);

    const sendRes = await request(httpServer)
      .post(`/documents/${doc.id}/send`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        recipients: [
          {
            recipient_email: recipient.user.email,
            recipient_name: 'Recipient User',
            user_id: recipient.user.patient_id,
          },
        ],
        locks: [{ type: 'PASSWORD', password: 'test123' }],
      })
      .expect(201);

    const body = sendRes.body as Record<string, unknown>;
    docWithLocks = {
      id: body.id as string,
      title: body.title as string,
      status: body.status as string,
    };

    // Fetch locks overview to get the lock ID
    const locksOverviewRes = await request(httpServer)
      .get(`/documents/${docWithLocks.id}/locks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const locksOverview = locksOverviewRes.body as Array<
      Record<string, unknown>
    >;
    if (locksOverview.length > 0) {
      lockId = locksOverview[0].id as string;
    }
  });

  afterAll(async () => {
    await cleanupUsers(app, [
      { userId: owner.user.patient_id, accessToken: owner.accessToken },
      { userId: recipient.user.patient_id, accessToken: recipient.accessToken },
    ]);
    await app.close();
  });

  // ── GET /documents/:id/locks (owner overview) ───────────────────────────────

  describe('GET /documents/:id/locks', () => {
    it('should return locks overview for the document owner (200)', () => {
      return request(httpServer)
        .get(`/documents/${docWithLocks.id}/locks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          const lock = res.body[0];
          expect(lock).toHaveProperty('id');
          expect(lock).toHaveProperty('lock_type');
          expect(lock.lock_type).toBe('PASSWORD');
          expect(lock).toHaveProperty('recipients');
          expect(Array.isArray(lock.recipients)).toBe(true);
        });
    });

    it('should return 401 without auth', () => {
      return request(httpServer)
        .get(`/documents/${docWithLocks.id}/locks`)
        .expect(401);
    });

    it('should return 404 for non-existent document', () => {
      return request(httpServer)
        .get(`/documents/00000000-0000-0000-0000-000000000000/locks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
    });

    it('should return 200 with empty locks for DRAFT document (no locks)', async () => {
      const draftDoc = await createTestDocument(app, owner.accessToken);

      try {
        await request(httpServer)
          .get(`/documents/${draftDoc.id}/locks`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(0);
          });
      } finally {
        // Clean up the draft doc
        await request(httpServer)
          .delete(`/documents/${draftDoc.id}`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .expect(204);
      }
    });
  });

  // ── POST /documents/:id/locks/:lockId/resolve (recipient resolves) ──────────

  describe('POST /documents/:id/locks/:lockId/resolve', () => {
    it('should resolve a PASSWORD lock with correct password (204)', () => {
      expect(lockId).toBeTruthy();

      return request(httpServer)
        .post(`/documents/${docWithLocks.id}/locks/${lockId}/resolve`)
        .set('Authorization', `Bearer ${recipient.accessToken}`)
        .send({ password: 'test123' })
        .expect(204);
    });

    it('should return 401 without auth', () => {
      return request(httpServer)
        .post(`/documents/${docWithLocks.id}/locks/${lockId}/resolve`)
        .send({ password: 'test123' })
        .expect(401);
    });

    it('should return 404 for non-existent lock', () => {
      return request(httpServer)
        .post(
          `/documents/${docWithLocks.id}/locks/00000000-0000-0000-0000-000000000000/resolve`,
        )
        .set('Authorization', `Bearer ${recipient.accessToken}`)
        .send({ password: 'test123' })
        .expect(404);
    });
  });
});
