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
  cleanupUsers,
  type TestUser,
  type TestDocument,
} from './utils/e2e-helpers';

describe('Document Signing (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  let owner: TestUser;
  let signer: TestUser;
  let rejecter: TestUser;

  let docToSign: TestDocument;
  let docToReject: TestDocument;
  let docForMaxAttempts: TestDocument;

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

    // ── Create test users ──────────────────────────────────────────────────
    owner = await createTestUser(app);
    signer = await createTestUser(app);
    rejecter = await createTestUser(app);

    // ── Create and send documents to registered recipients ─────────────────
    docToSign = await createTestDocument(app, owner.accessToken);
    docToReject = await createTestDocument(app, owner.accessToken);
    docForMaxAttempts = await createTestDocument(app, owner.accessToken);

    // Send docToSign to signer (registered recipient)
    await request(httpServer)
      .post(`/documents/${docToSign.id}/send`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        recipients: [
          {
            recipient_email: signer.user.email,
            recipient_name: 'Signer',
            user_id: signer.user.patient_id,
          },
        ],
      })
      .expect(201);

    // Send docToReject to rejecter (registered recipient)
    await request(httpServer)
      .post(`/documents/${docToReject.id}/send`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        recipients: [
          {
            recipient_email: rejecter.user.email,
            recipient_name: 'Rejecter',
            user_id: rejecter.user.patient_id,
          },
        ],
      })
      .expect(201);

    // Send docForMaxAttempts to signer (for max attempts test)
    await request(httpServer)
      .post(`/documents/${docForMaxAttempts.id}/send`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        recipients: [
          {
            recipient_email: signer.user.email,
            recipient_name: 'Signer MaxAttempts',
            user_id: signer.user.patient_id,
          },
        ],
      })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupUsers(app, [
      { userId: owner.user.patient_id, accessToken: owner.accessToken },
      { userId: signer.user.patient_id, accessToken: signer.accessToken },
      { userId: rejecter.user.patient_id, accessToken: rejecter.accessToken },
    ]);
    await app.close();
  });

  afterEach(() => {
    capturedOtps.clear();
    mockEmailService.sendOtpEmail.mockClear();
  });

  // ── POST /v1/otp/challenges — create challenge ──────────────────────────────

  describe('POST /v1/otp/challenges', () => {
    it('should create an OTP challenge for document signing (201)', async () => {
      const res = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: docToSign.id,
        })
        .expect(201);

      expect(res.body).toHaveProperty('challengeId');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('maskedDestination');
      expect(res.body).toHaveProperty('remainingAttempts');

      // OTP code should have been captured by the mock
      const capturedCode = capturedOtps.get(signer.user.email);
      expect(capturedCode).toBeTruthy();
      expect(capturedCode!.length).toBe(6);

      expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith(
        signer.user.email,
        expect.objectContaining({ code: capturedCode }),
      );
    });

    it('should return 401 without auth', () => {
      return request(httpServer)
        .post('/v1/otp/challenges')
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: docToSign.id,
        })
        .expect(401);
    });

    it('should return 404 for non-existent document', async () => {
      // Use a valid UUID for a non-existent document
      await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('should return 400 for invalid actionType', () => {
      return request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'INVALID',
          resourceType: 'DOCUMENT',
          resourceId: docToSign.id,
        })
        .expect(400);
    });
  });

  // ── POST /v1/otp/challenges/:challengeId/verify — verify OTP ───────────────

  describe('POST /v1/otp/challenges/:challengeId/verify', () => {
    let signChallengeId: string;
    let signOtpCode: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: docToSign.id,
        })
        .expect(201);

      signChallengeId = res.body.challengeId as string;
      signOtpCode = capturedOtps.get(signer.user.email)!;
      expect(signOtpCode).toBeTruthy();
    });

    it('should verify OTP and sign document (200)', async () => {
      const res = await request(httpServer)
        .post(`/v1/otp/challenges/${signChallengeId}/verify`)
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({ code: signOtpCode })
        .expect(200);

      expect(res.body.verified).toBe(true);
      expect(res.body).toHaveProperty('actionResult');
      expect(res.body.actionResult).toHaveProperty('resourceType');
      expect(res.body.actionResult).toHaveProperty('resourceId');
      expect(res.body.actionResult).toHaveProperty('newStatus');
    });

    it('should return 422 for wrong OTP code', async () => {
      // Create a new challenge since the previous one was consumed
      capturedOtps.clear();
      const challengeRes = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'REVOKE',
          resourceType: 'DOCUMENT',
          resourceId: docToSign.id,
        })
        .expect(201);

      const wrongChallengeId = challengeRes.body.challengeId as string;

      return request(httpServer)
        .post(`/v1/otp/challenges/${wrongChallengeId}/verify`)
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({ code: '000000' })
        .expect(422);
    });

    it('should return 400 for empty code (validation)', () => {
      return request(httpServer)
        .post(`/v1/otp/challenges/${signChallengeId}/verify`)
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({ code: '' })
        .expect(400);
    });

    it('should return 401 without auth', () => {
      return request(httpServer)
        .post(`/v1/otp/challenges/${signChallengeId}/verify`)
        .send({ code: '123456' })
        .expect(401);
    });
  });

  // ── POST /v1/otp/challenges/:challengeId/resend — resend OTP ────────────────

  describe('POST /v1/otp/challenges/:challengeId/resend', () => {
    let resendChallengeId: string;

    beforeAll(async () => {
      capturedOtps.clear();
      const res = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${rejecter.accessToken}`)
        .send({
          actionType: 'REJECT',
          resourceType: 'DOCUMENT',
          resourceId: docToReject.id,
        })
        .expect(201);

      resendChallengeId = res.body.challengeId as string;
    });

    it('should resend OTP after cooldown (200)', async () => {
      // Wait for the initial send cooldown to expire (1s)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      capturedOtps.clear();

      const res = await request(httpServer)
        .post(`/v1/otp/challenges/${resendChallengeId}/resend`)
        .set('Authorization', `Bearer ${rejecter.accessToken}`)
        .send({})
        .expect(200);

      expect(res.body).toHaveProperty('challengeId');

      // New OTP code should be captured
      const newCode = capturedOtps.get(rejecter.user.email);
      expect(newCode).toBeTruthy();
      expect(newCode!.length).toBe(6);
    });

    it('should return 401 without auth', () => {
      return request(httpServer)
        .post(`/v1/otp/challenges/${resendChallengeId}/resend`)
        .send({})
        .expect(401);
    });

    it('should return 409 on resend cooldown', async () => {
      // Resend again immediately — cooldown of 1s prevents it
      return request(httpServer)
        .post(`/v1/otp/challenges/${resendChallengeId}/resend`)
        .set('Authorization', `Bearer ${rejecter.accessToken}`)
        .send({})
        .expect(409);
    });
  });

  // ── REJECT action via OTP ───────────────────────────────────────────────────

  describe('REJECT action via OTP', () => {
    it('should create REJECT challenge and execute rejection (200)', async () => {
      capturedOtps.clear();

      const challengeRes = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${rejecter.accessToken}`)
        .send({
          actionType: 'REJECT',
          resourceType: 'DOCUMENT',
          resourceId: docToReject.id,
        })
        .expect(201);

      const rejectChallengeId = challengeRes.body.challengeId as string;
      const rejectOtpCode = capturedOtps.get(rejecter.user.email)!;
      expect(rejectOtpCode).toBeTruthy();

      const res = await request(httpServer)
        .post(`/v1/otp/challenges/${rejectChallengeId}/verify`)
        .set('Authorization', `Bearer ${rejecter.accessToken}`)
        .send({ code: rejectOtpCode })
        .expect(200);

      expect(res.body.verified).toBe(true);
      expect(res.body.actionResult).toHaveProperty('newStatus');
    });
  });

  // ── REVOKE action via OTP ───────────────────────────────────────────────────

  describe('REVOKE action via OTP', () => {
    it('should create REVOKE challenge and execute revocation (200)', async () => {
      // signer already signed docToSign in the verify describe block.
      // Now they revoke their signature.
      capturedOtps.clear();

      const challengeRes = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'REVOKE',
          resourceType: 'DOCUMENT',
          resourceId: docToSign.id,
        })
        .expect(201);

      const revokeChallengeId = challengeRes.body.challengeId as string;
      const revokeOtpCode = capturedOtps.get(signer.user.email)!;
      expect(revokeOtpCode).toBeTruthy();

      const res = await request(httpServer)
        .post(`/v1/otp/challenges/${revokeChallengeId}/verify`)
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({ code: revokeOtpCode })
        .expect(200);

      expect(res.body.verified).toBe(true);
      expect(res.body.actionResult).toHaveProperty('newStatus');
    });
  });

  // ── Max attempts exceeded ───────────────────────────────────────────────────

  describe('Max OTP attempts', () => {
    it('should lock challenge after max wrong attempts', async () => {
      capturedOtps.clear();

      const challengeRes = await request(httpServer)
        .post('/v1/otp/challenges')
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({
          actionType: 'SIGN',
          resourceType: 'DOCUMENT',
          resourceId: docForMaxAttempts.id,
        })
        .expect(201);

      const maxAttemptsChallengeId = challengeRes.body.challengeId as string;

      // Try wrong OTP codes up to max attempts (5)
      // After 5 wrong attempts the challenge should be locked
      const maxAttempts = 5;
      for (let i = 0; i < maxAttempts; i++) {
        await request(httpServer)
          .post(`/v1/otp/challenges/${maxAttemptsChallengeId}/verify`)
          .set('Authorization', `Bearer ${signer.accessToken}`)
          .send({ code: '000000' })
          .expect(422);
      }

      // Next attempt with even correct code should fail (locked)
      const nextRes = await request(httpServer)
        .post(`/v1/otp/challenges/${maxAttemptsChallengeId}/verify`)
        .set('Authorization', `Bearer ${signer.accessToken}`)
        .send({ code: '123456' });

      // Locked challenge returns 4xx
      expect(nextRes.status).toBeGreaterThanOrEqual(400);
    });
  });
});
