import type { Request } from 'express';

export interface RequestContext {
  /** Unique identifier for this request (correlation ID) */
  requestId: string;
  /** ISO timestamp when the request was received */
  receivedAt: string;
  /** Authenticated user ID (populated after auth) */
  userId?: string;
  /** Authenticated user role (populated after auth) */
  role?: string;
  /** Additional permissions/scopes (populated after auth) */
  permissions?: string[];
}

/** Extend Express Request with our context */
export interface AppRequest extends Request {
  id: string;
  context: RequestContext;
}
