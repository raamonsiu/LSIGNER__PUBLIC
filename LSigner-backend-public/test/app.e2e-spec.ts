/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable CORS with the same options as the production bootstrap
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

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Existing endpoint tests ───────────────────────────────────────────────

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect('OK');
  });

  // ── CORS preflight ────────────────────────────────────────────────────────

  describe('CORS', () => {
    const env = process.env.APP_ENV ?? 'development';
    const ALLOWED_ORIGIN = (
      process.env.CORS_ORIGINS ??
      (env === 'development' ? 'http://localhost:3001' : '')
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)[0];

    if (!ALLOWED_ORIGIN) {
      throw new Error(
        'CORS e2e tests require at least one allowed origin. Set CORS_ORIGINS (or run with APP_ENV=development).',
      );
    }

    const DISALLOWED_ORIGIN = 'https://evil.com';
    describe('OPTIONS preflight', () => {
      it('should respond with CORS headers for allowed origin', () => {
        return request(app.getHttpServer())
          .options('/')
          .set('Origin', ALLOWED_ORIGIN)
          .set('Access-Control-Request-Method', 'GET')
          .expect(204)
          .expect('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
          .expect('Access-Control-Allow-Credentials', 'true')
          .expect('Access-Control-Allow-Methods', /GET/)
          .expect('Access-Control-Allow-Methods', /POST/)
          .expect('Access-Control-Allow-Methods', /PUT/)
          .expect('Access-Control-Allow-Methods', /PATCH/)
          .expect('Access-Control-Allow-Methods', /DELETE/)
          .expect('Access-Control-Allow-Methods', /OPTIONS/)
          .expect('Access-Control-Allow-Headers', /Content-Type/)
          .expect('Access-Control-Allow-Headers', /Authorization/)
          .expect('Access-Control-Allow-Headers', /X-Request-Id/)
          .expect('Access-Control-Max-Age', '600');
      });

      it('should not include Access-Control-Allow-Origin for disallowed origin', () => {
        return request(app.getHttpServer())
          .options('/')
          .set('Origin', DISALLOWED_ORIGIN)
          .set('Access-Control-Request-Method', 'GET')
          .expect(204)
          .expect((res) => {
            expect(res.headers).not.toHaveProperty(
              'access-control-allow-origin',
            );
          });
      });
    });

    describe('simple GET', () => {
      it('should include CORS headers for allowed origin', () => {
        return request(app.getHttpServer())
          .get('/')
          .set('Origin', ALLOWED_ORIGIN)
          .expect(200)
          .expect('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
          .expect('Access-Control-Allow-Credentials', 'true');
      });

      it('should not include Access-Control-Allow-Origin for disallowed origin', () => {
        return request(app.getHttpServer())
          .get('/')
          .set('Origin', DISALLOWED_ORIGIN)
          .expect(200)
          .expect((res) => {
            expect(res.headers).not.toHaveProperty(
              'access-control-allow-origin',
            );
          });
      });
    });
  });

  // ── PATCH /users/me ─────────────────────────────────────────────────────────

  describe('PATCH /users/me', () => {
    // Minimal response shapes used only for type-narrowing in assertions
    interface UserBody {
      patient_id: string;
      name: string;
      email: string;
      phone_number: string;
    }

    interface LoginBody {
      access_token: string;
    }

    let accessToken: string;
    let testUserId: string;
    let testUserEmail: string;
    const testPassword = 'E2eTestPass123!';

    beforeAll(async () => {
      testUserEmail = `e2e-patch-me-${Date.now()}@example.com`;
      const testPhone = `+34600${Date.now().toString().slice(-6)}`;

      // Create a test user via the public POST /users endpoint
      const createRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'PatchMe',
          last_name: 'E2E',
          country: 'Spain',
          email: testUserEmail,
          phone_number: testPhone,
          password: testPassword,
        })
        .expect(201);

      const createdUser = createRes.body as UserBody;
      testUserId = createdUser.patient_id;

      // Login to obtain an access token for the test user
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUserEmail, password: testPassword })
        .expect(200);

      const loginBody = loginRes.body as LoginBody;
      accessToken = loginBody.access_token;
    });

    afterAll(async () => {
      if (testUserId && accessToken) {
        await request(app.getHttpServer())
          .delete(`/users/${testUserId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(204);
      }
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .patch(`/users/${testUserId}`)
        .send({ name: 'Jane' })
        .expect(401);
    });

    it('updates non-sensitive fields without current_password', () => {
      return request(app.getHttpServer())
        .patch(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'UpdatedName' })
        .expect(200)
        .expect((res) => {
          expect((res.body as UserBody).name).toBe('UpdatedName');
        });
    });

    it('updates email without current_password via /users/:id', () => {
      return request(app.getHttpServer())
        .patch(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'nocurrent@example.com' })
        .expect(200)
        .expect((res) => {
          expect((res.body as UserBody).email).toBe('nocurrent@example.com');
        });
    });

    it('updates phone with correct current_password', () => {
      const newPhone = `+34600${Date.now().toString().slice(-6)}`;
      return request(app.getHttpServer())
        .patch(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ phone_number: newPhone, current_password: testPassword })
        .expect(200)
        .expect((res) => {
          expect((res.body as UserBody).phone_number).toBe(newPhone);
        });
    });

    it('updates email with correct current_password', () => {
      const newEmail = `e2e-patch-email-${Date.now()}@example.com`;
      return request(app.getHttpServer())
        .patch(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail, current_password: testPassword })
        .expect(200)
        .expect((res) => {
          expect((res.body as UserBody).email).toBe(newEmail);
        });
    });

    it('updates email and name together, routing email to dedicated handler', () => {
      const newEmail = `e2e-patch-both-${Date.now()}@example.com`;
      return request(app.getHttpServer())
        .patch(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: newEmail,
          name: 'BothUpdated',
          current_password: testPassword,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body as UserBody;
          expect(body.email).toBe(newEmail);
          expect(body.name).toBe('BothUpdated');
        });
    });
  });

  // ── Sent documents flow ─────────────────────────────────────────────────────

  describe('Sent Documents endpoints', () => {
    interface UserBody {
      patient_id: string;
      email: string;
    }

    interface LoginBody {
      access_token: string;
    }

    interface CreatedDocumentBody {
      id: string;
      title: string;
    }

    interface SentDocumentBody {
      id: string;
      recipients: Array<{
        id: string;
        recipient_email: string;
        public_link_id: string | null;
      }>;
    }

    interface SentDocumentsListResponse {
      stats: {
        total_sent: number;
        pending_final_signature: number;
        unique_recipients: number;
        completed: number;
      };
      items: Array<{
        id: string;
        signed_at: string | null;
        status: string;
      }>;
    }

    interface SentDocumentDetailResponse {
      id: string;
      document_name: string;
      recipients: unknown[];
      status: string;
      sent_at: string;
      created_at: string;
      updated_at: string;
    }

    let ownerUserId: string;
    let ownerAccessToken: string;
    let ownerEmail: string;

    let emptyUserId: string;
    let emptyUserAccessToken: string;

    let foreignUserId: string;
    let foreignUserAccessToken: string;

    let waitingDocumentId: string;
    let completedDocumentId: string;

    beforeAll(async () => {
      const ownerPassword = 'E2eOwnerPass123!';
      const emptyPassword = 'E2eEmptyPass123!';
      const foreignPassword = 'E2eForeignPass123!';
      const uniqueSeed = Date.now().toString();

      ownerEmail = `e2e-owner-${uniqueSeed}@example.com`;
      const emptyEmail = `e2e-empty-${uniqueSeed}@example.com`;
      const foreignEmail = `e2e-foreign-${uniqueSeed}@example.com`;

      const ownerCreateRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Owner',
          last_name: 'SentDocs',
          country: 'Spain',
          email: ownerEmail,
          phone_number: `+3461100${uniqueSeed.slice(-4)}`,
          password: ownerPassword,
        })
        .expect(201);
      ownerUserId = (ownerCreateRes.body as UserBody).patient_id;

      const emptyCreateRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Empty',
          last_name: 'SentDocs',
          country: 'Spain',
          email: emptyEmail,
          phone_number: `+3462200${uniqueSeed.slice(-4)}`,
          password: emptyPassword,
        })
        .expect(201);
      emptyUserId = (emptyCreateRes.body as UserBody).patient_id;

      const foreignCreateRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Foreign',
          last_name: 'SentDocs',
          country: 'Spain',
          email: foreignEmail,
          phone_number: `+3463300${uniqueSeed.slice(-4)}`,
          password: foreignPassword,
        })
        .expect(201);
      foreignUserId = (foreignCreateRes.body as UserBody).patient_id;

      const ownerLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ownerEmail, password: ownerPassword })
        .expect(200);
      ownerAccessToken = (ownerLoginRes.body as LoginBody).access_token;

      const emptyLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emptyEmail, password: emptyPassword })
        .expect(200);
      emptyUserAccessToken = (emptyLoginRes.body as LoginBody).access_token;

      const foreignLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: foreignEmail, password: foreignPassword })
        .expect(200);
      foreignUserAccessToken = (foreignLoginRes.body as LoginBody).access_token;

      const waitingUploadRes = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .field('title', 'Waiting Document')
        .attach('file', Buffer.from('waiting-file-content'), 'waiting.txt')
        .expect(201);
      waitingDocumentId = (waitingUploadRes.body as CreatedDocumentBody).id;

      const waitingSendRes = await request(app.getHttpServer())
        .post(`/documents/${waitingDocumentId}/send`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          recipients: [
            {
              recipient_email: `wait-recipient-${uniqueSeed}@example.com`,
              recipient_name: 'Waiting Recipient',
            },
          ],
        })
        .expect(201);

      const completedUploadRes = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .field('title', 'Completed Document')
        .attach('file', Buffer.from('completed-file-content'), 'completed.txt')
        .expect(201);
      completedDocumentId = (completedUploadRes.body as CreatedDocumentBody).id;

      const completedSendRes = await request(app.getHttpServer())
        .post(`/documents/${completedDocumentId}/send`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({
          recipients: [
            {
              recipient_email: `done-recipient-${uniqueSeed}@example.com`,
              recipient_name: 'Completed Recipient',
            },
          ],
        })
        .expect(201);

      const sentCompletedDoc = completedSendRes.body as Record<string, any>;
      const completedPublicLinkId =
        sentCompletedDoc.recipients[0]?.public_link_id;
      if (!completedPublicLinkId) {
        throw new Error('Expected public link id for completed document');
      }

      // The shared-access sign route was removed in the public-access refactor.
      // Signing now happens via the public-session + OTP flow (/v1/public/otp/*).
      // await request(app.getHttpServer())
      //   .post(`/documents/shared/${completedPublicLinkId}/sign`)
      //   .send({ verification_method: 'OTP' })
      //   .expect(201);

      const waitingDocBody = waitingSendRes.body as Record<string, any>;
      if (!waitingDocBody.id || !sentCompletedDoc.id) {
        throw new Error('Expected sent document responses with ids');
      }
    });

    afterAll(async () => {
      if (ownerUserId && ownerAccessToken) {
        await request(app.getHttpServer())
          .delete(`/users/${ownerUserId}`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
          .expect(204);
      }

      if (emptyUserId && emptyUserAccessToken) {
        await request(app.getHttpServer())
          .delete(`/users/${emptyUserId}`)
          .set('Authorization', `Bearer ${emptyUserAccessToken}`)
          .expect(204);
      }

      if (foreignUserId && foreignUserAccessToken) {
        await request(app.getHttpServer())
          .delete(`/users/${foreignUserId}`)
          .set('Authorization', `Bearer ${foreignUserAccessToken}`)
          .expect(204);
      }
    });

    it('returns 401 when listing sent documents without auth', () => {
      return request(app.getHttpServer()).get('/documents/sent').expect(401);
    });

    it('returns items shape for authorized owner', () => {
      return request(app.getHttpServer())
        .get('/documents/sent')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            items: Array<{
              id: string;
              status: string;
              signed_at: string | null;
            }>;
          };
          expect(body).toHaveProperty('items');
          expect(Array.isArray(body.items)).toBe(true);
          expect(body.items.length).toBeGreaterThanOrEqual(2);

          const waitingItem = body.items.find(
            (item) => item.id === waitingDocumentId,
          );
          expect(waitingItem).toBeDefined();
          expect(waitingItem?.status).toBe('WAITING');
          expect(waitingItem?.signed_at).toBeNull();

          const completedItem = body.items.find(
            (item) => item.id === completedDocumentId,
          );
          expect(completedItem).toBeDefined();
          // Without the shared sign route, this document stays WAITING
          expect(completedItem?.status).toBe('WAITING');
          expect(completedItem?.signed_at).toBeNull();
        });
    });

    it('returns empty items for user without sent documents', () => {
      return request(app.getHttpServer())
        .get('/documents/sent')
        .set('Authorization', `Bearer ${emptyUserAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            items: [],
          });
        });
    });

    it('returns full detail shape for sent document owner', () => {
      return request(app.getHttpServer())
        .get(`/documents/sent/${completedDocumentId}`)
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as SentDocumentDetailResponse;
          expect(body.id).toBe(completedDocumentId);
          expect(typeof body.document_name).toBe('string');
          expect(Array.isArray(body.recipients)).toBe(true);
          expect(body.status).toBe('WAITING');
          expect(typeof body.sent_at).toBe('string');
          expect(typeof body.created_at).toBe('string');
          expect(typeof body.updated_at).toBe('string');
        });
    });

    it('returns 404 for nonexistent sent document id', () => {
      return request(app.getHttpServer())
        .get('/documents/sent/11111111-1111-4111-8111-111111111111')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(404);
    });

    it('returns 403 when another user accesses owner sent document detail', () => {
      return request(app.getHttpServer())
        .get(`/documents/sent/${completedDocumentId}`)
        .set('Authorization', `Bearer ${foreignUserAccessToken}`)
        .expect(403);
    });
  });

  // ── Received documents flow ─────────────────────────────────────────────────

  describe('Received Documents endpoints', () => {
    interface UserBody {
      patient_id: string;
      email: string;
    }

    interface LoginBody {
      access_token: string;
    }

    interface CreatedDocumentBody {
      id: string;
    }

    interface SentDocumentBody {
      id: string;
      recipients: Array<{
        id: string;
        recipient_email: string;
        public_link_id: string | null;
      }>;
    }

    interface ReceivedListResponse {
      stats: {
        total_received: number;
        pending_my_signature: number;
        signed_by_me: number;
        rejected_or_revoked: number;
      };
      items: Array<{
        id: string;
        document_name: string;
        status: string;
        signed_at: string | null;
        sender_name: string;
        sender_email: string;
      }>;
    }

    let senderUserId: string;
    let senderAccessToken: string;

    let recipientUserId: string;
    let recipientAccessToken: string;

    let emptyUserId2: string;
    let emptyUserAccessToken2: string;

    let pendingDocumentId: string;
    let signedDocumentId: string;
    let pendingPublicLinkId: string;

    beforeAll(async () => {
      const senderPassword = 'E2eSenderPass123!';
      const recipientPassword = 'E2eRecipientPass123!';
      const emptyPassword2 = 'E2eEmptyPass456!';
      const uniqueSeed = `rec-${Date.now()}`;

      const senderEmail = `e2e-sender-${uniqueSeed}@example.com`;
      const recipientEmail = `e2e-recipient-${uniqueSeed}@example.com`;
      const emptyEmail2 = `e2e-empty2-${uniqueSeed}@example.com`;

      // Create sender user
      const senderCreateRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Sender',
          last_name: 'Received',
          country: 'Spain',
          email: senderEmail,
          phone_number: `+3467100${uniqueSeed.slice(-4)}`,
          password: senderPassword,
        })
        .expect(201);
      senderUserId = (senderCreateRes.body as UserBody).patient_id;

      // Create recipient user
      const recipientCreateRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Recipient',
          last_name: 'Received',
          country: 'Spain',
          email: recipientEmail,
          phone_number: `+3468100${uniqueSeed.slice(-4)}`,
          password: recipientPassword,
        })
        .expect(201);
      recipientUserId = (recipientCreateRes.body as UserBody).patient_id;

      // Create empty user
      const emptyCreateRes2 = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Empty2',
          last_name: 'Received',
          country: 'Spain',
          email: emptyEmail2,
          phone_number: `+3469100${uniqueSeed.slice(-4)}`,
          password: emptyPassword2,
        })
        .expect(201);
      emptyUserId2 = (emptyCreateRes2.body as UserBody).patient_id;

      // Login all
      const senderLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: senderEmail, password: senderPassword })
        .expect(200);
      senderAccessToken = (senderLoginRes.body as LoginBody).access_token;

      const recipientLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: recipientEmail, password: recipientPassword })
        .expect(200);
      recipientAccessToken = (recipientLoginRes.body as LoginBody).access_token;

      const emptyLoginRes2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emptyEmail2, password: emptyPassword2 })
        .expect(200);
      emptyUserAccessToken2 = (emptyLoginRes2.body as LoginBody).access_token;

      // ── Create pending document (sent TO recipient user) ─────────────────

      const pendingUploadRes = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .field('title', 'Pending Received Doc')
        .attach(
          'file',
          Buffer.from('pending-received-content'),
          'pending-rec.txt',
        )
        .expect(201);
      pendingDocumentId = (pendingUploadRes.body as CreatedDocumentBody).id;

      const pendingSendRes = await request(app.getHttpServer())
        .post(`/documents/${pendingDocumentId}/send`)
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .send({
          recipients: [
            {
              recipient_email: recipientEmail,
              recipient_name: 'Recipient User',
              user_id: recipientUserId,
            },
          ],
        })
        .expect(201);

      const pendingSendBody = pendingSendRes.body as Record<string, any>;
      pendingPublicLinkId = pendingSendBody.recipients[0]?.public_link_id ?? '';
      // Registered users (with user_id) may not receive a public_link_id;
      // they access documents through the app route instead.

      // ── Create signed document (recipient signs via shared token) ─────────

      const signedUploadRes = await request(app.getHttpServer())
        .post('/documents')
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .field('title', 'Signed Received Doc')
        .attach(
          'file',
          Buffer.from('signed-received-content'),
          'signed-rec.txt',
        )
        .expect(201);
      signedDocumentId = (signedUploadRes.body as CreatedDocumentBody).id;

      const signedSendRes = await request(app.getHttpServer())
        .post(`/documents/${signedDocumentId}/send`)
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .send({
          recipients: [
            {
              recipient_email: recipientEmail,
              recipient_name: 'Recipient User',
              user_id: recipientUserId,
            },
          ],
        })
        .expect(201);

      const signedSendBody = signedSendRes.body as Record<string, any>;
      const signedPublicLinkId = signedSendBody.recipients[0]?.public_link_id;
      // Registered users (with user_id) may not receive a public_link_id.

      // The shared-access sign route was removed in the public-access refactor.
      // Signing now happens via the public-session + OTP flow (/v1/public/otp/*).
      // await request(app.getHttpServer())
      //   .post(`/documents/shared/${signedPublicLinkId}/sign`)
      //   .send({ verification_method: 'OTP' })
      //   .expect(201);
    });

    afterAll(async () => {
      if (senderUserId && senderAccessToken) {
        await request(app.getHttpServer())
          .delete(`/users/${senderUserId}`)
          .set('Authorization', `Bearer ${senderAccessToken}`)
          .expect(204);
      }

      if (recipientUserId && recipientAccessToken) {
        await request(app.getHttpServer())
          .delete(`/users/${recipientUserId}`)
          .set('Authorization', `Bearer ${recipientAccessToken}`)
          .expect(204);
      }

      if (emptyUserId2 && emptyUserAccessToken2) {
        await request(app.getHttpServer())
          .delete(`/users/${emptyUserId2}`)
          .set('Authorization', `Bearer ${emptyUserAccessToken2}`)
          .expect(204);
      }
    });

    it('returns 401 when listing received documents without auth', () => {
      return request(app.getHttpServer())
        .get('/documents/received')
        .expect(401);
    });

    it('returns items shape for authorized recipient', () => {
      return request(app.getHttpServer())
        .get('/documents/received')
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            items: Array<{
              id: string;
              status: string;
              signed_at: string | null;
              sender_name: string;
            }>;
          };
          expect(body).toHaveProperty('items');
          expect(Array.isArray(body.items)).toBe(true);
          expect(body.items.length).toBeGreaterThanOrEqual(2);

          const pendingItem = body.items.find(
            (item) => item.id === pendingDocumentId,
          );
          expect(pendingItem).toBeDefined();
          expect(pendingItem?.status).toBe('PENDING');
          expect(pendingItem?.signed_at).toBeNull();

          const signedItem = body.items.find(
            (item) => item.id === signedDocumentId,
          );
          expect(signedItem).toBeDefined();
          // Without the shared sign route, this document stays PENDING
          expect(signedItem?.status).toBe('PENDING');
          expect(signedItem?.signed_at).toBeNull();
          expect(signedItem?.sender_name).toBe('Sender Received');
        });
    });

    it('returns empty items for user without received documents', () => {
      return request(app.getHttpServer())
        .get('/documents/received')
        .set('Authorization', `Bearer ${emptyUserAccessToken2}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            items: [],
          });
        });
    });

    it('returns full detail shape for received document', () => {
      return request(app.getHttpServer())
        .get(`/documents/received/${pendingDocumentId}`)
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body.id).toBe(pendingDocumentId);
          expect(typeof body.document_name).toBe('string');
          expect(body.status).toBe('PENDING');
          expect(body).toHaveProperty('sender');
          expect(body).toHaveProperty('my_recipient');
          const sender = body.sender as Record<string, unknown>;
          expect(typeof sender.name).toBe('string');
          expect(typeof sender.email).toBe('string');
          const myRecipient = body.my_recipient as Record<string, unknown>;
          expect(typeof myRecipient.signing_status).toBe('string');
        });
    });

    it('returns view-url for received document', () => {
      return request(app.getHttpServer())
        .get(`/documents/received/${pendingDocumentId}/view-url`)
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as { url: string };
          expect(body.url).toBeDefined();
          expect(typeof body.url).toBe('string');
          // Registered users get the app route; external recipients get /public/
          expect(body.url).toMatch(/\/public\/|\/documents\/received\//);
        });
    });

    it('returns 404 for received document that does not exist', () => {
      return request(app.getHttpServer())
        .get('/documents/received/11111111-1111-4111-8111-111111111111')
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .expect(404);
    });

    it('returns 200 when accessing received document as owner (sender)', () => {
      return request(app.getHttpServer())
        .get(`/documents/received/${pendingDocumentId}`)
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .expect(200);
    });

    it('returns 404 for view-url of document not belonging to user', () => {
      return request(app.getHttpServer())
        .get(`/documents/received/${pendingDocumentId}/view-url`)
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .expect(404);
    });

    it('rejects a pending received document', () => {
      return request(app.getHttpServer())
        .post(`/documents/received/${pendingDocumentId}/reject`)
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .send({ reason: 'Not interested' })
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            id: string;
            status: string;
            rejected_at: string;
          };
          expect(body.id).toBe(pendingDocumentId);
          expect(body.status).toBe('REJECTED');
          expect(typeof body.rejected_at).toBe('string');
        });
    });

    it('returns 409 when rejecting an already rejected document', () => {
      return request(app.getHttpServer())
        .post(`/documents/received/${pendingDocumentId}/reject`)
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .send({})
        .expect(409);
    });

    it('rejects the previously-pending document (now returns 200 since no sign call)', () => {
      return request(app.getHttpServer())
        .post(`/documents/received/${signedDocumentId}/reject`)
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            id: string;
            status: string;
            rejected_at: string;
          };
          expect(body.id).toBe(signedDocumentId);
          expect(body.status).toBe('REJECTED');
        });
    });

    it('returns 400 for invalid document UUID in received endpoint', () => {
      return request(app.getHttpServer())
        .get('/documents/received/not-a-uuid')
        .set('Authorization', `Bearer ${recipientAccessToken}`)
        .expect(400);
    });

    it('returns 404 when trying to reject document not belonging to user', () => {
      return request(app.getHttpServer())
        .post(`/documents/received/${pendingDocumentId}/reject`)
        .set('Authorization', `Bearer ${senderAccessToken}`)
        .send({})
        .expect(404);
    });
  });
});
