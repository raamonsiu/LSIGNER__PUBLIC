import type { Request } from 'express';

export interface PublicSessionContext {
  sessionId: string;
  recipientId: string;
  documentId: string;
  recipientEmail: string;
  recipientName: string | null;
}

export interface RequestWithPublicSession extends Request {
  publicSession?: PublicSessionContext;
}
