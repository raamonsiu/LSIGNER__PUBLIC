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

describe('Users CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  let owner: TestUser;
  let otherUser: TestUser;

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

    owner = await createTestUser(app, { name: 'OwnerUser' });
    otherUser = await createTestUser(app, { name: 'OtherUser' });
  });

  afterAll(async () => {
    const cleanupList: Array<{ userId: string; accessToken: string }> = [];
    if (owner) {
      cleanupList.push({
        userId: owner.user.patient_id,
        accessToken: owner.accessToken,
      });
    }
    if (otherUser) {
      cleanupList.push({
        userId: otherUser.user.patient_id,
        accessToken: otherUser.accessToken,
      });
    }
    if (cleanupList.length > 0) {
      await cleanupUsers(app, cleanupList);
    }
    await app.close();
  });

  // ── POST /users ─────────────────────────────────────────────────────────────

  describe('POST /users (public endpoint)', () => {
    it('returns 201 and user object without password', async () => {
      const uniqueSuffix = Date.now().toString().slice(-8);
      const res = await request(httpServer)
        .post('/users')
        .send({
          name: 'New',
          last_name: 'User',
          country: 'Spain',
          email: `e2e-create-${uniqueSuffix}@example.com`,
          phone_number: `+3461100${uniqueSuffix.slice(-4)}`,
          password: 'ValidPass123!',
        })
        .expect(201);

      expect(res.body).toHaveProperty('patient_id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('name');
      expect(res.body.email).toBe(`e2e-create-${uniqueSuffix}@example.com`);
      // Password must never be returned
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('salt');
    });

    it('returns 409 when email already exists', async () => {
      await request(httpServer)
        .post('/users')
        .send({
          name: 'Dup',
          last_name: 'Email',
          country: 'Spain',
          email: owner.user.email, // same email as existing user
          phone_number: `+3461100${Date.now().toString().slice(-4)}`,
          password: 'ValidPass123!',
        })
        .expect(409);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(httpServer)
        .post('/users')
        .send({
          name: 'Bad',
          last_name: 'Email',
          country: 'Spain',
          email: 'not-an-email',
          phone_number: `+3461100${Date.now().toString().slice(-4)}`,
          password: 'ValidPass123!',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('returns 400 when required fields are missing (no name)', async () => {
      const res = await request(httpServer)
        .post('/users')
        .send({
          last_name: 'NoName',
          country: 'Spain',
          email: `e2e-noname-${Date.now()}@example.com`,
          phone_number: `+3461100${Date.now().toString().slice(-4)}`,
          password: 'ValidPass123!',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  // ── GET /users/me ───────────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('returns 200 with authenticated user profile', async () => {
      const res = await request(httpServer)
        .get('/users/me')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('patient_id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('phone_number');
      expect(res.body.patient_id).toBe(owner.user.patient_id);
      expect(res.body.email).toBe(owner.user.email);
      // Password fields must not be exposed
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('salt');
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer).get('/users/me').expect(401);
    });

    it('returns 401 with invalid access token', async () => {
      await request(httpServer)
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token-that-does-not-exist')
        .expect(401);
    });
  });

  // ── PATCH /users/:id ────────────────────────────────────────────────────────

  describe('PATCH /users/:id (update profile)', () => {
    it('returns 200 and updates own profile name', async () => {
      const newName = `Updated-${Date.now()}`;
      const res = await request(httpServer)
        .patch(`/users/${owner.user.patient_id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: newName })
        .expect(200);

      expect(res.body.name).toBe(newName);

      // Verify persistence via GET /users/me
      const meRes = await request(httpServer)
        .get('/users/me')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(meRes.body.name).toBe(newName);
    });

    it('allows update of another user profile (no ownership enforcement)', async () => {
      // NOTE: PATCH /users/:id does NOT enforce that the requester is the owner.
      // Any authenticated user can update any profile. This is the current behavior.
      const res = await request(httpServer)
        .patch(`/users/${otherUser.user.patient_id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'ChangedByOwner' })
        .expect(200);

      expect(res.body.name).toBe('ChangedByOwner');

      // Restore original name
      await request(httpServer)
        .patch(`/users/${otherUser.user.patient_id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ name: 'OtherUser' })
        .expect(200);
    });
  });

  // ── PATCH /users/:id/email ──────────────────────────────────────────────────

  describe('PATCH /users/:id/email', () => {
    it('returns 200 when updating to a new unique email', async () => {
      const newEmail = `e2e-updated-${Date.now()}@example.com`;
      const res = await request(httpServer)
        .patch(`/users/${owner.user.patient_id}/email`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ new_email: newEmail })
        .expect(200);

      expect(res.body.email).toBe(newEmail);

      // Can still authenticate with new email
      const loginRes = await loginUser(app, newEmail, owner.password);
      expect(loginRes.accessToken).toBeDefined();

      // Restore original email and token for subsequent tests
      const restoreRes = await request(httpServer)
        .patch(`/users/${owner.user.patient_id}/email`)
        .set('Authorization', `Bearer ${loginRes.accessToken}`)
        .send({ new_email: owner.user.email })
        .expect(200);

      expect(restoreRes.body.email).toBe(owner.user.email);
      owner.accessToken = (
        await loginUser(app, owner.user.email, owner.password)
      ).accessToken;
    });

    it('returns 409 when new email is already in use', async () => {
      await request(httpServer)
        .patch(`/users/${owner.user.patient_id}/email`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ new_email: otherUser.user.email })
        .expect(409);
    });
  });

  // ── DELETE /users/:id ───────────────────────────────────────────────────────

  describe('DELETE /users/:id', () => {
    let tempUser: TestUser;

    beforeAll(async () => {
      tempUser = await createTestUser(app, { name: 'ToDelete' });
    });

    it('returns 204 when deleting own account (soft delete)', async () => {
      await request(httpServer)
        .delete(`/users/${tempUser.user.patient_id}`)
        .set('Authorization', `Bearer ${tempUser.accessToken}`)
        .expect(204);
    });

    it('returns 404 after deletion (user no longer exists)', async () => {
      // JWT is still valid but user is gone — returns 404
      await request(httpServer)
        .get('/users/me')
        .set('Authorization', `Bearer ${tempUser.accessToken}`)
        .expect(404);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .delete(`/users/${owner.user.patient_id}`)
        .expect(401);
    });
  });

  // ── GET /users/search ───────────────────────────────────────────────────────

  describe('GET /users/search?q=', () => {
    it('returns 200 with matching users when searching by last_name', async () => {
      // All test users share last_name='E2E' — search should return at least 2 users
      const res = await request(httpServer)
        .get('/users/search')
        .query({ q: 'E2E' })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Search results use `id` field (not `patient_id`)
      const match = (res.body as Record<string, unknown>[]).find(
        (u) => u.id === owner.user.patient_id,
      );
      expect(match).toBeDefined();
      expect(match).toHaveProperty('email');
      expect(match).toHaveProperty('name');
      // Sensitive fields must not be in search results
      expect(match).not.toHaveProperty('password');
      expect(match).not.toHaveProperty('phone_number');
    });

    it('returns 200 with matching users when searching by email substring', async () => {
      // Search for a substring of owner's email (the local part prefix)
      const emailLocalPart = owner.user.email.split('@')[0].slice(-8);
      const res = await request(httpServer)
        .get('/users/search')
        .query({ q: emailLocalPart })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const match = (res.body as Record<string, unknown>[]).find(
        (u) => u.id === owner.user.patient_id,
      );
      expect(match).toBeDefined();
    });

    it('returns empty array when no users match', async () => {
      const res = await request(httpServer)
        .get('/users/search')
        .query({ q: `zzz-no-match-${Date.now()}` })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .get('/users/search')
        .query({ q: 'test' })
        .expect(401);
    });
  });
});
