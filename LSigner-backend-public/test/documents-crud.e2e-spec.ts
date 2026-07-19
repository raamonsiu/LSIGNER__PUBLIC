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
  createTestDocument,
  sendDocumentToRecipient,
  cleanupUsers,
  type TestUser,
  type TestDocument,
  type TestDocumentRecipient,
} from './utils/e2e-helpers';

describe('Documents CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  let owner: TestUser;
  let otherUser: TestUser;

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

    owner = await createTestUser(app, { name: 'DocOwner' });
    otherUser = await createTestUser(app, { name: 'OtherDocUser' });
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  // ── POST /documents ─────────────────────────────────────────────────────────

  describe('POST /documents (upload)', () => {
    it('returns 201 and creates a document in DRAFT status', async () => {
      const res = await request(httpServer)
        .post('/documents')
        .set(auth(owner.accessToken))
        .field('title', `E2E Upload ${Date.now()}`)
        .attach('file', Buffer.from('test-content-for-e2e'), 'test.txt')
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe('DRAFT');
      expect(typeof res.body.id).toBe('string');
      expect(res.body.title).toContain('E2E Upload');
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .post('/documents')
        .field('title', 'Unauthorized Upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(401);
    });

    it('returns 400 when no file is attached (just title field)', async () => {
      const res = await request(httpServer)
        .post('/documents')
        .set(auth(owner.accessToken))
        .field('title', 'No File Upload')
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });
  });

  // ── GET /documents ──────────────────────────────────────────────────────────

  describe('GET /documents (list)', () => {
    it('returns 200 with items array', async () => {
      const res = await request(httpServer)
        .get('/documents')
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer).get('/documents').expect(401);
    });
  });

  // ── GET /documents/:id ──────────────────────────────────────────────────────

  describe('GET /documents/:id', () => {
    let doc: TestDocument;

    beforeAll(async () => {
      doc = await createTestDocument(app, owner.accessToken);
    });

    it('returns 200 with document metadata', async () => {
      const res = await request(httpServer)
        .get(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status');
      expect(res.body.id).toBe(doc.id);
    });

    it('returns 404 for non-existent document', async () => {
      await request(httpServer)
        .get('/documents/00000000-0000-0000-0000-000000000000')
        .set(auth(owner.accessToken))
        .expect(404);
    });

    it('returns 403 when another user tries to access (not owner nor recipient)', async () => {
      await request(httpServer)
        .get(`/documents/${doc.id}`)
        .set(auth(otherUser.accessToken))
        .expect(403);
    });
  });

  // ── GET /documents/:id/download ─────────────────────────────────────────────

  describe('GET /documents/:id/download', () => {
    let doc: TestDocument;

    beforeAll(async () => {
      doc = await createTestDocument(app, owner.accessToken, {
        title: 'Download Doc',
        fileBuffer: Buffer.from('downloadable-content'),
        fileName: 'download-test.txt',
      });
    });

    it('returns 200 with binary content and Content-Disposition header', async () => {
      const res = await request(httpServer)
        .get(`/documents/${doc.id}/download`)
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.headers['content-disposition']).toBeDefined();
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('download-test.txt');
      // Binary content should be non-empty (supertest parses as object/text)
      expect(res.body).toBeTruthy();
      expect(res.headers['content-type']).toBeDefined();
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .get(`/documents/${doc.id}/download`)
        .expect(401);
    });
  });

  // ── PATCH /documents/:id ────────────────────────────────────────────────────

  describe('PATCH /documents/:id (update)', () => {
    let doc: TestDocument;

    beforeAll(async () => {
      doc = await createTestDocument(app, owner.accessToken, {
        title: 'Original Title',
      });
    });

    it('returns 200 when updating metadata of a DRAFT document', async () => {
      const newTitle = `Updated ${Date.now()}`;
      const res = await request(httpServer)
        .patch(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .field('title', newTitle)
        .expect(200);

      expect(res.body).toHaveProperty('title');
      expect(res.body.title).toBe(newTitle);

      // Verify persistence via GET
      const getRes = await request(httpServer)
        .get(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .expect(200);

      expect(getRes.body.title).toBe(newTitle);
    });

    it('returns 404 for non-existent document', async () => {
      await request(httpServer)
        .patch('/documents/00000000-0000-0000-0000-000000000000')
        .set(auth(owner.accessToken))
        .field('title', 'Ghost')
        .expect(404);
    });

    it('returns 403 when non-owner tries to update', async () => {
      await request(httpServer)
        .patch(`/documents/${doc.id}`)
        .set(auth(otherUser.accessToken))
        .field('title', 'Hijacked')
        .expect(403);
    });
  });

  // ── POST /documents/:id/send ────────────────────────────────────────────────

  describe('POST /documents/:id/send', () => {
    let draftDoc: TestDocument;
    let _sentDoc: TestDocument;
    let recipient: TestDocumentRecipient;

    beforeAll(async () => {
      draftDoc = await createTestDocument(app, owner.accessToken, {
        title: 'To Send',
      });
    });

    it('returns 201 and transitions DRAFT -> SENT with recipients', async () => {
      recipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        draftDoc.id,
        `e2e-recipient-${Date.now()}@example.com`,
        'Recipient Name',
      );

      expect(recipient).toHaveProperty('id');
      expect(recipient).toHaveProperty('recipient_email');
      expect(recipient.recipient_email).toContain('e2e-recipient');

      // Verify document status is now SENT
      const res = await request(httpServer)
        .get(`/documents/${draftDoc.id}`)
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body.status).toBe('SENT');
    });

    it('returns 400 when recipient email is invalid', async () => {
      const newDoc = await createTestDocument(app, owner.accessToken, {
        title: 'Bad Recipient',
      });

      await request(httpServer)
        .post(`/documents/${newDoc.id}/send`)
        .set(auth(owner.accessToken))
        .send({
          recipients: [
            { recipient_email: 'not-an-email', recipient_name: 'Bad' },
          ],
        })
        .expect(400);
    });

    it('returns 409 when document was already sent', async () => {
      // draftDoc is already sent from the first test
      await request(httpServer)
        .post(`/documents/${draftDoc.id}/send`)
        .set(auth(owner.accessToken))
        .send({
          recipients: [
            {
              recipient_email: `e2e-resend-${Date.now()}@example.com`,
              recipient_name: 'Resend',
            },
          ],
        })
        .expect(409);
    });

    it('returns 403 when non-owner tries to send', async () => {
      const newDoc = await createTestDocument(app, owner.accessToken, {
        title: 'Owner Only',
      });

      await request(httpServer)
        .post(`/documents/${newDoc.id}/send`)
        .set(auth(otherUser.accessToken))
        .send({
          recipients: [
            {
              recipient_email: `e2e-other-${Date.now()}@example.com`,
            },
          ],
        })
        .expect(403);
    });
  });

  // ── GET /documents/sent ─────────────────────────────────────────────────────

  describe('GET /documents/sent', () => {
    it('returns 200 with sent documents list', async () => {
      const res = await request(httpServer)
        .get('/documents/sent')
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);

      // Owner should have at least one sent document from the send tests
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer).get('/documents/sent').expect(401);
    });
  });

  // ── GET /documents/received ─────────────────────────────────────────────────

  describe('GET /documents/received', () => {
    it('returns 200 with received documents list', async () => {
      const res = await request(httpServer)
        .get('/documents/received')
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer).get('/documents/received').expect(401);
    });
  });

  // ── DELETE /documents/:id ───────────────────────────────────────────────────

  describe('DELETE /documents/:id', () => {
    it('returns 204 when deleting a DRAFT document (hard delete)', async () => {
      const doc = await createTestDocument(app, owner.accessToken, {
        title: 'To Delete DRAFT',
      });

      await request(httpServer)
        .delete(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .expect(204);

      // Verify document is gone
      await request(httpServer)
        .get(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .expect(404);
    });

    it('returns 204 when deleting a SENT document (DELETED, not hard-deleted)', async () => {
      // Create and send a document
      const doc = await createTestDocument(app, owner.accessToken, {
        title: 'To Delete',
      });
      await sendDocumentToRecipient(
        app,
        owner.accessToken,
        doc.id,
        `e2e-delete-${Date.now()}@example.com`,
      );

      await request(httpServer)
        .delete(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .expect(204);

      // SENT documents are not fully deleted — verify status is DELETED
      const res = await request(httpServer)
        .get(`/documents/${doc.id}`)
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body.status).toBe('DELETED');
    });

    it('returns 401 without authorization header', async () => {
      await request(httpServer)
        .delete('/documents/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const doc = await createTestDocument(app, owner.accessToken, {
        title: 'Not Yours',
      });

      await request(httpServer)
        .delete(`/documents/${doc.id}`)
        .set(auth(otherUser.accessToken))
        .expect(403);
    });
  });

  // ── DELETE /documents/:id/recipients/:recipientId/shared-access ─────────────

  describe('DELETE /documents/:id/recipients/:recipientId/shared-access', () => {
    let doc: TestDocument;
    let recipient: TestDocumentRecipient;

    beforeAll(async () => {
      doc = await createTestDocument(app, owner.accessToken, {
        title: 'Revoke Access Test',
      });
      recipient = await sendDocumentToRecipient(
        app,
        owner.accessToken,
        doc.id,
        `e2e-revoke-${Date.now()}@example.com`,
      );
    });

    it('returns 204 when owner revokes recipient shared access', async () => {
      await request(httpServer)
        .delete(`/documents/${doc.id}/recipients/${recipient.id}/shared-access`)
        .set(auth(owner.accessToken))
        .expect(204);
    });
  });

  // ── GET /documents/timeline ───────────────────────────────────────────────

  describe('GET /documents/timeline', () => {
    it('returns 200 with items array for authenticated user', async () => {
      const res = await request(httpServer)
        .get('/documents/timeline')
        .set(auth(owner.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 401 without authorization header', async () => {
      const res = await request(httpServer)
        .get('/documents/timeline')
        .expect(401);

      expect(res.body).toHaveProperty('message');
    });

    it('returns 401 with invalid token', async () => {
      await request(httpServer)
        .get('/documents/timeline')
        .set('Authorization', 'Bearer invalid-token-value')
        .expect(401);
    });

    it('returns 200 with empty items for user with no documents', async () => {
      const blankUser = await createTestUser(app, {
        name: 'TimelineBlank',
        email: undefined,
        password: undefined,
        phone: undefined,
      });

      const res = await request(httpServer)
        .get('/documents/timeline')
        .set(auth(blankUser.accessToken))
        .expect(200);

      expect(res.body.items).toEqual([]);

      if (blankUser) {
        await cleanupUsers(app, [
          {
            userId: blankUser.user.patient_id,
            accessToken: blankUser.accessToken,
          },
        ]);
      }
    });
  });
});
