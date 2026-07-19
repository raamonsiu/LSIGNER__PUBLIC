/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './../src/common/interceptors/logging.interceptor';
import { EmailService } from './../src/email/email.service';
import {
  createTestUser,
  createTestDocument,
  sendDocumentToRecipient,
  cleanupUsers,
  extractPublicSessionCookie,
  type TestUser,
  type TestDocument,
  type TestDocumentRecipient,
} from './utils/e2e-helpers';

describe('Public Access (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  let owner: TestUser;
  let doc: TestDocument;
  let recipient: TestDocumentRecipient;
  let publicLinkId: string;
  let sessionCookie: string;

  const capturedOtps = new Map<string, string>();

  // ── EmailService mock ───────────────────────────────────────────────────────

  const mockEmailService = {
    sendOtpEmail: jest
      .fn()
      .mockImplementation((to: string, data: { code: string }) => {
        capturedOtps.set(to, data.code);
        return Promise.resolve();
      }),
    sendDocumentNotification: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendSignedNotification: jest.fn().mockResolvedValue(undefined),
    sendRejectedNotification: jest.fn().mockResolvedValue(undefined),
    sendRevokedNotification: jest.fn().mockResolvedValue(undefined),
    sendReminder: jest.fn().mockResolvedValue(undefined),
    sendUnshared: jest.fn().mockResolvedValue(undefined),
    sendAccountDeleted: jest.fn().mockResolvedValue(undefined),
    sendMail: jest.fn().mockResolvedValue(undefined),
    onModuleInit: jest.fn(),
  };

  // ── Setup / Teardown ────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

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

    // ── Create test data ───────────────────────────────────────────────────
    owner = await createTestUser(app);

    doc = await createTestDocument(app, owner.accessToken);

    // Send document to an external (anonymous) recipient to get a public_link_id
    const externalEmail = `e2e-public-ext-${Date.now()}@example.com`;
    recipient = await sendDocumentToRecipient(
      app,
      owner.accessToken,
      doc.id,
      externalEmail,
      'External Recipient',
    );

    publicLinkId = recipient.public_link_id!;
    expect(publicLinkId).toBeTruthy();

    // Bootstrap a public session to get a cookie
    const bootstrapRes = await request(httpServer)
      .post('/v1/public/session/bootstrap')
      .send({ publicLinkId })
      .expect(200);

    expect(bootstrapRes.body.status).toBe('ANON_ALLOWED');
    expect(bootstrapRes.body).toHaveProperty('documentId');
    expect(bootstrapRes.headers['set-cookie']).toBeTruthy();

    sessionCookie = extractPublicSessionCookie(bootstrapRes);
    expect(sessionCookie).toBeTruthy();
  });

  afterAll(async () => {
    await cleanupUsers(app, [
      { userId: owner.user.patient_id, accessToken: owner.accessToken },
    ]);
    await app.close();
  });

  afterEach(() => {
    capturedOtps.clear();
    mockEmailService.sendOtpEmail.mockClear();
  });

  // ── POST /v1/public/session/bootstrap ──────────────────────────────────────

  describe('POST /v1/public/session/bootstrap', () => {
    it('should bootstrap a public session with a valid publicLinkId (200)', async () => {
      // Use a fresh document + external recipient for an isolated bootstrap test
      const freshDoc = await createTestDocument(app, owner.accessToken);
      const freshEmail = `e2e-public-bootstrap-${Date.now()}@example.com`;
      const freshRecipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        freshDoc.id,
        freshEmail,
        'Bootstrap Test',
      );

      const res = await request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({ publicLinkId: freshRecipient.public_link_id })
        .expect(200);

      expect(res.body.status).toBe('ANON_ALLOWED');
      expect(res.body).toHaveProperty('documentId');
      expect(res.headers['set-cookie']).toBeTruthy();

      const cookie = extractPublicSessionCookie(res);
      expect(cookie).toMatch(/^ls_public_session=/);
    });

    it('should return 404 for an invalid public_link_id', () => {
      return request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({ publicLinkId: 'nonexistent-link-id-12345' })
        .expect(404);
    });

    it('should return 400 when publicLinkId is missing', () => {
      return request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({})
        .expect(400);
    });
  });

  // ── GET /v1/public/documents/me ────────────────────────────────────────────

  describe('GET /v1/public/documents/me', () => {
    it('should return the document with a valid session cookie (200)', async () => {
      const res = await request(httpServer)
        .get('/v1/public/documents/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status');
    });

    it('should return 403 without a session cookie', () => {
      return request(httpServer).get('/v1/public/documents/me').expect(403);
    });

    it('should return 403 with an invalid session cookie', () => {
      return request(httpServer)
        .get('/v1/public/documents/me')
        .set('Cookie', 'ls_public_session=invalid-token-value')
        .expect(403);
    });
  });

  // ── POST /v1/public/otp/challenges ────────────────────────────────────────

  describe('POST /v1/public/otp/challenges', () => {
    it('should create an OTP challenge via public session (201)', async () => {
      const res = await request(httpServer)
        .post('/v1/public/otp/challenges')
        .set('Cookie', sessionCookie)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: doc.id,
        })
        .expect(201);

      expect(res.body).toHaveProperty('challengeId');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('maskedDestination');
      expect(res.body).toHaveProperty('remainingAttempts');

      // OTP code should have been captured by the mock
      const capturedCode = capturedOtps.get(recipient.recipient_email);
      expect(capturedCode).toBeTruthy();
      expect(capturedCode!.length).toBe(6);

      expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith(
        recipient.recipient_email,
        expect.objectContaining({ code: capturedCode }),
      );
    });

    it('should return 403 without a session cookie', () => {
      return request(httpServer)
        .post('/v1/public/otp/challenges')
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: doc.id,
        })
        .expect(403);
    });
  });

  // ── POST /v1/public/otp/challenges/:challengeId/verify ────────────────────

  describe('POST /v1/public/otp/challenges/:challengeId/verify', () => {
    let verifyChallengeId: string;
    let verifyOtpCode: string;

    beforeAll(async () => {
      capturedOtps.clear();

      const challengeRes = await request(httpServer)
        .post('/v1/public/otp/challenges')
        .set('Cookie', sessionCookie)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: doc.id,
        })
        .expect(201);

      verifyChallengeId = challengeRes.body.challengeId as string;
      verifyOtpCode = capturedOtps.get(recipient.recipient_email)!;
      expect(verifyOtpCode).toBeTruthy();
    });

    it('should verify OTP and execute sign via public session (200)', async () => {
      const res = await request(httpServer)
        .post(`/v1/public/otp/challenges/${verifyChallengeId}/verify`)
        .set('Cookie', sessionCookie)
        .send({ code: verifyOtpCode })
        .expect(200);

      expect(res.body.verified).toBe(true);
      expect(res.body).toHaveProperty('actionResult');
      expect(res.body.actionResult).toHaveProperty('resourceType');
      expect(res.body.actionResult).toHaveProperty('resourceId');
      expect(res.body.actionResult).toHaveProperty('newStatus');
    });
  });

  // ── POST /v1/public/otp/challenges/:challengeId/resend ────────────────────

  describe('POST /v1/public/otp/challenges/:challengeId/resend', () => {
    let resendCookie: string;
    let resendChallengeId: string;

    beforeAll(async () => {
      capturedOtps.clear();

      // Use a fresh document for resend test (one active challenge per scope)
      const resendDoc = await createTestDocument(app, owner.accessToken);
      const resendEmail = `e2e-public-resend-${Date.now()}@example.com`;
      const resendRecipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        resendDoc.id,
        resendEmail,
        'Resend Recipient',
      );

      // Bootstrap a fresh session for this document
      const bootstrapRes = await request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({ publicLinkId: resendRecipient.public_link_id })
        .expect(200);

      resendCookie = extractPublicSessionCookie(bootstrapRes);

      const challengeRes = await request(httpServer)
        .post('/v1/public/otp/challenges')
        .set('Cookie', resendCookie)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: resendDoc.id,
        })
        .expect(201);

      resendChallengeId = challengeRes.body.challengeId as string;
    });

    it('should resend OTP via public session after cooldown (200)', async () => {
      // Wait for the initial send cooldown to expire (1s)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      capturedOtps.clear();

      const res = await request(httpServer)
        .post(`/v1/public/otp/challenges/${resendChallengeId}/resend`)
        .set('Cookie', resendCookie)
        .send({})
        .expect(200);

      expect(res.body).toHaveProperty('challengeId');
    });
  });

  // ── POST /v1/public/session/logout ─────────────────────────────────────────

  describe('POST /v1/public/session/logout', () => {
    it('should logout the public session (204)', async () => {
      // Bootstrap a fresh session to logout independently
      const logoutDoc = await createTestDocument(app, owner.accessToken);
      const logoutEmail = `e2e-public-logout-${Date.now()}@example.com`;
      const logoutRecipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        logoutDoc.id,
        logoutEmail,
        'Logout Recipient',
      );

      const bootstrapRes = await request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({ publicLinkId: logoutRecipient.public_link_id })
        .expect(200);

      const logoutCookie = extractPublicSessionCookie(bootstrapRes);

      await request(httpServer)
        .post('/v1/public/session/logout')
        .set('Cookie', logoutCookie)
        .expect(204);
    });

    it('should return 403 when accessing protected route after logout', async () => {
      // Bootstrap, logout, then try to access — should be rejected
      const afterLogoutDoc = await createTestDocument(app, owner.accessToken);
      const afterLogoutEmail = `e2e-public-afterlogout-${Date.now()}@example.com`;
      const afterLogoutRecipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        afterLogoutDoc.id,
        afterLogoutEmail,
        'AfterLogout Recipient',
      );

      const bootstrapRes = await request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({ publicLinkId: afterLogoutRecipient.public_link_id })
        .expect(200);

      const cookie = extractPublicSessionCookie(bootstrapRes);

      // Logout
      await request(httpServer)
        .post('/v1/public/session/logout')
        .set('Cookie', cookie)
        .expect(204);

      // Now accessing protected route should fail
      await request(httpServer)
        .get('/v1/public/documents/me')
        .set('Cookie', cookie)
        .expect(403);
    });
  });

  // ── Public session end-to-end flow ─────────────────────────────────────────

  describe('End-to-end public session flow', () => {
    it('should complete: bootstrap -> view -> challenge -> verify -> sign -> logout', async () => {
      // 1. Create a document and send to external recipient
      const flowDoc = await createTestDocument(app, owner.accessToken);
      const flowEmail = `e2e-public-flow-${Date.now()}@example.com`;
      const flowRecipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        flowDoc.id,
        flowEmail,
        'Flow Recipient',
      );

      // 2. Bootstrap public session
      const bootstrapRes = await request(httpServer)
        .post('/v1/public/session/bootstrap')
        .send({ publicLinkId: flowRecipient.public_link_id })
        .expect(200);

      expect(bootstrapRes.body.status).toBe('ANON_ALLOWED');
      const flowCookie = extractPublicSessionCookie(bootstrapRes);

      // 3. View the document
      const viewRes = await request(httpServer)
        .get('/v1/public/documents/me')
        .set('Cookie', flowCookie)
        .expect(200);

      expect(viewRes.body).toHaveProperty('id');
      expect(viewRes.body).toHaveProperty('title');
      expect(viewRes.body).toHaveProperty('status');

      // 4. Create OTP challenge for signing
      capturedOtps.clear();
      const challengeRes = await request(httpServer)
        .post('/v1/public/otp/challenges')
        .set('Cookie', flowCookie)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: flowDoc.id,
        })
        .expect(201);

      const flowChallengeId = challengeRes.body.challengeId as string;
      const flowOtpCode = capturedOtps.get(flowEmail);
      expect(flowOtpCode).toBeTruthy();

      // 5. Verify OTP (this executes the sign action)
      const verifyRes = await request(httpServer)
        .post(`/v1/public/otp/challenges/${flowChallengeId}/verify`)
        .set('Cookie', flowCookie)
        .send({ code: flowOtpCode })
        .expect(200);

      expect(verifyRes.body.verified).toBe(true);
      expect(verifyRes.body).toHaveProperty('actionResult');

      // 6. Logout
      await request(httpServer)
        .post('/v1/public/session/logout')
        .set('Cookie', flowCookie)
        .expect(204);

      // 7. Verify session is no longer valid after logout
      await request(httpServer)
        .get('/v1/public/documents/me')
        .set('Cookie', flowCookie)
        .expect(403);
    });
  });
});
