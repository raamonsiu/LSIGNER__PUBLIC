/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

// ── Public interfaces ──────────────────────────────────────────────────────────

export interface TestUser {
  user: {
    patient_id: string;
    email: string;
    name: string;
  };
  accessToken: string;
  refreshToken: string;
  password: string;
}

export interface TestDocument {
  id: string;
  title: string;
  status: string;
}

export interface TestDocumentRecipient {
  id: string;
  recipient_email: string;
  public_link_id: string | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function httpServer(
  app: INestApplication,
): ReturnType<INestApplication['getHttpServer']> {
  return app.getHttpServer();
}

function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;
}

function uniquePhone(): string {
  const suffix = Date.now().toString().slice(-4);
  return `+3461100${suffix}`;
}

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Creates a test user via POST /users, logs in, and returns the user profile
 * together with access and refresh tokens.
 *
 * Unique email and phone seeds are generated automatically.  Pass `overrides`
 * to supply custom values (e.g. a known email for recipient matching).
 */
export async function createTestUser(
  app: INestApplication,
  overrides?: Partial<{
    email: string;
    password: string;
    phone: string;
    name: string;
  }>,
): Promise<TestUser> {
  const password = overrides?.password ?? 'E2eTestPass123!';
  const email = overrides?.email ?? uniqueEmail('user');
  const phone = overrides?.phone ?? uniquePhone();
  const name = overrides?.name ?? 'TestUser';

  const createRes = await request(httpServer(app))
    .post('/users')
    .send({
      name,
      last_name: 'E2E',
      country: 'Spain',
      email,
      phone_number: phone,
      password,
    })
    .expect(201);

  const user = createRes.body as Record<string, unknown>;

  const loginRes = await request(httpServer(app))
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const tokens = loginRes.body as Record<string, unknown>;

  return {
    user: {
      patient_id: user.patient_id as string,
      email: user.email as string,
      name: user.name as string,
    },
    accessToken: tokens.access_token as string,
    refreshToken: tokens.refresh_token as string,
    password,
  };
}

/**
 * Logs in an existing user and returns the token pair.
 */
export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const loginRes = await request(httpServer(app))
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const body = loginRes.body as Record<string, unknown>;

  return {
    accessToken: body.access_token as string,
    refreshToken: body.refresh_token as string,
  };
}

/**
 * Deletes every user in the list.  Individual 404 responses are silently
 * ignored (the user may already have been removed by a previous step).
 */
export async function cleanupUsers(
  app: INestApplication,
  entries: Array<{ userId: string; accessToken: string }>,
): Promise<void> {
  for (const { userId, accessToken } of entries) {
    try {
      await request(httpServer(app))
        .delete(`/users/${userId}`)
        .set(authHeader(accessToken))
        .expect(204);
    } catch {
      // User may already be deleted — continue silently
    }
  }
}

/**
 * Creates a document (DRAFT) by uploading a file via multipart/form-data.
 */
export async function createTestDocument(
  app: INestApplication,
  accessToken: string,
  overrides?: Partial<{
    title: string;
    fileBuffer: Buffer;
    fileName: string;
  }>,
): Promise<TestDocument> {
  const title = overrides?.title ?? `E2E Doc ${Date.now()}`;
  const fileBuffer = overrides?.fileBuffer ?? Buffer.from('e2e-test-content');
  const fileName = overrides?.fileName ?? 'e2e-test.txt';

  const uploadRes = await request(httpServer(app))
    .post('/documents')
    .set(authHeader(accessToken))
    .field('title', title)
    .attach('file', fileBuffer, fileName)
    .expect(201);

  const body = uploadRes.body as Record<string, unknown>;

  return {
    id: body.id as string,
    title: body.title as string,
    status: body.status as string,
  };
}

/**
 * Sends a document to a recipient.  Returns the recipient record including
 * the `public_link_id` (set when sending to an external email-only recipient).
 */
export async function sendDocumentToRecipient(
  app: INestApplication,
  accessToken: string,
  documentId: string,
  recipientEmail: string,
  recipientName?: string,
): Promise<TestDocumentRecipient> {
  const sendRes = await request(httpServer(app))
    .post(`/documents/${documentId}/send`)
    .set(authHeader(accessToken))
    .send({
      recipients: [
        {
          recipient_email: recipientEmail,
          recipient_name: recipientName ?? 'Recipient',
        },
      ],
    })
    .expect(201);

  const body = sendRes.body as Record<string, unknown>;
  const recipients = body.recipients as Array<Record<string, unknown>>;

  if (!recipients || recipients.length === 0) {
    throw new Error('sendDocumentToRecipient: no recipients in response');
  }

  const recipient = recipients[0];

  return {
    id: recipient.id as string,
    recipient_email: recipient.recipient_email as string,
    public_link_id: (recipient.public_link_id as string) ?? null,
  };
}

/**
 * Retrieves the last captured OTP code for the given email address from the
 * mock's captured-OTP map.  Returns `undefined` if no code has been captured.
 *
 * The map is created per test-file in the `beforeAll` block and passed to the
 * EmailService mock.  Example:
 *
 * ```ts
 * const capturedOtps = new Map<string, string>();
 * // … EmailService mock stores into capturedOtps …
 * const code = getLastOtpCode(capturedOtps, recipientEmail);
 * ```
 */
export function getLastOtpCode(
  capturedOtps: Map<string, string>,
  email: string,
): string | undefined {
  return capturedOtps.get(email);
}

/**
 * Extracts the public session cookie value from a `set-cookie` response header.
 *
 * @param res — supertest Response from a POST /v1/public/session/bootstrap call.
 * @returns The cookie name=value pair (e.g. `ls_public_session=abc123`).
 * @throws If no `set-cookie` header is present.
 */
export function extractPublicSessionCookie(res: request.Response): string {
  const setCookieHeader = res.headers['set-cookie'];

  if (!setCookieHeader) {
    throw new Error(
      'extractPublicSessionCookie: no set-cookie header in response',
    );
  }

  const raw = Array.isArray(setCookieHeader)
    ? setCookieHeader[0]
    : setCookieHeader;

  return (raw as string).split(';')[0];
}
