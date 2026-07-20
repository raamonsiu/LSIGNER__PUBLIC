/**
 * API contract types: DTOs and response shapes that cross the wire.
 *
 * Defined in the API layer so endpoints don't depend on `@/lib/auth/types`.
 * Auth-related modules re-export from here.
 */

/** Authenticated user data returned by GET /users/me. */
export interface AuthUser {
  patient_id: string;
  name: string;
  last_name: string;
  country: string;
  national_id: string | null;
  passport: string | null;
  email: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
}

/** Payload returned by POST /auth/login (TokensResponseDto). */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

/** DTO sent to POST /users (CreateUserDto). */
export interface RegisterDto {
  name: string;
  last_name: string;
  country: string;
  national_id?: string;
  passport?: string;
  email: string;
  phone_number: string;
  password: string;
}

export type SentDocumentStatus =
  | 'DRAFT'
  | 'WAITING'
  | 'COMPLETED'
  | 'VOIDED'
  | 'SUPERSEDED'
  | 'DELETED';

export type RecipientSigningStatus =
  | 'PENDING'
  | 'SIGNED'
  | 'REJECTED'
  | 'REVOKED';

export type VerificationMethod = 'OTP';

export interface SentDocumentsStats {
  total_sent: number;
  pending_final_signature: number;
  unique_recipients: number;
  completed: number;
}

export interface SentDocumentsListItem {
  id: string;
  document_name: string;
  file_size_bytes: number;
  sent_at: string;
  signed_at: string | null;
  final_recipient_name: string | null;
  status: SentDocumentStatus;
}

export interface SentRecipientListItem {
  recipient_email: string;
  recipient_name: string | null;
  signing_status: RecipientSigningStatus;
  signed_at: string | null;
  sent_at: string;
  document_id: string;
  document_name: string;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
}

export interface SentRecipientsStats {
  total: number;
  pending: number;
  signed: number;
  rejected: number;
  revoked: number;
}

export interface SentRecipientsListResponse {
  stats?: SentRecipientsStats;
  items: SentRecipientListItem[];
}

export interface SentDocumentsListResponse {
  stats: SentDocumentsStats;
  items: SentDocumentsListItem[];
}

export interface SentDocumentRecipient {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  signing_status: RecipientSigningStatus;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
  signed_at: string | null;
}

export interface SentDocumentDetailResponse {
  id: string;
  document_name: string;
  description: string | null;
  file_size_bytes: number;
  original_filename: string;
  mime_type: string;
  version: number;
  status: SentDocumentStatus;
  sent_at: string;
  signed_at: string | null;
  final_recipient_name: string | null;
  created_at: string;
  updated_at: string;
  recipients: SentDocumentRecipient[];
}

export interface SentDocumentViewUrlResponse {
  url: string;
}

export type ReceivedDocumentStatus =
  | 'PENDING'
  | 'SIGNED'
  | 'REJECTED'
  | 'REVOKED';

export interface ReceivedDocumentsStats {
  total_received: number;
  pending_my_signature: number;
  signed_by_me: number;
  rejected_or_revoked: number;
}

export interface ReceivedDocumentsListItem {
  id: string;
  document_name: string;
  file_size_bytes: number;
  received_at: string;
  signed_at: string | null;
  expires_at: string | null;
  sender_name: string | null;
  sender_email: string;
  status: ReceivedDocumentStatus;
}

export interface ReceivedDocumentsListResponse {
  stats?: ReceivedDocumentsStats;
  items: ReceivedDocumentsListItem[];
}

export interface ReceivedDocumentRecipientInfo {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  signing_status: ReceivedDocumentStatus;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
  signed_at: string | null;
  rejected_at: string | null;
  revoked_at: string | null;
}

export interface ReceivedDocumentSender {
  id: string;
  name: string;
  email: string;
  deleted: boolean;
}

export interface ReceivedDocumentDetailResponse {
  id: string;
  document_name: string;
  description: string | null;
  file_size_bytes: number;
  original_filename: string;
  mime_type: string;
  version: number;
  status: ReceivedDocumentStatus;
  received_at: string;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  sender: ReceivedDocumentSender;
  my_recipient: ReceivedDocumentRecipientInfo;
}

export interface ReceivedDocumentViewUrlResponse {
  url: string;
}

// ──────────────────────────────────────────────
// Document locks (shared/public access)
// ──────────────────────────────────────────────

export type DocumentLockType = 'PASSWORD';

export interface SharedDocumentLockStatus {
  id: string;
  lock_type: DocumentLockType;
  is_resolved: boolean;
  resolved_at: string | null;
}

export interface PrivateDocumentLockRecipientResolution {
  recipient_id: string;
  recipient_email?: string;
  recipient_name?: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
}

export interface PrivateDocumentLockStatus {
  id: string;
  lock_type: DocumentLockType;
  is_resolved?: boolean;
  resolved_at?: string | null;
  recipients?: PrivateDocumentLockRecipientResolution[];
  recipient_resolutions?: PrivateDocumentLockRecipientResolution[];
}

export interface ResolveLockDto {
  password: string;
}

export type PublicSessionBootstrapStatus = 'ANON_ALLOWED' | 'AUTH_REQUIRED';

export interface PublicSessionBootstrapResponse {
  status: PublicSessionBootstrapStatus;
  documentId: string;
}

export interface PublicDocumentRecipient {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  signing_status: ReceivedDocumentStatus;
  signed_at: string | null;
  rejected_at: string | null;
  revoked_at: string | null;
}

export interface PublicDocumentMeResponse {
  id: string;
  document_name: string;
  description: string | null;
  file_size_bytes: number;
  original_filename: string;
  mime_type: string;
  status: ReceivedDocumentStatus;
  expires_at: string | null;
  sender_name: string | null;
  sender_email: string;
  my_recipient: PublicDocumentRecipient;
}

export interface PublicDocumentActionDto {
  verification_method: VerificationMethod;
  verification_reference?: string;
  reason?: string;
}

export interface SignedDocumentResult {
  artifact_id: string;
  document_id: string;
  recipient_id: string;
  status: ReceivedDocumentStatus;
  signed_at: string;
  signature_algorithm: string;
}

// ──────────────────────────────────────────────
// OTP challenges
// ──────────────────────────────────────────────

export type DocumentActionType = 'SIGN' | 'REJECT' | 'REVOKE';

export interface OtpChallengeResponse {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string | null;
  maskedDestination: string;
  remainingAttempts: number;
  remainingResends: number;
}

export interface OtpChallengeResendResponse {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
  remainingResends: number;
}

export interface OtpActionResult {
  resourceType: string;
  resourceId: string;
  newStatus: string;
  metadata?: Record<string, unknown>;
}

export interface OtpVerifyResponse {
  verified: boolean;
  actionResult: OtpActionResult;
}

// ──────────────────────────────────────────────
// History Timeline
// ──────────────────────────────────────────────

/** Unified timeline item for the history feed (client-side merged view). */
export interface TimelineItem {
  id: string;
  direction: 'sent' | 'received';
  documentName: string;
  otherPartyName: string;
  eventType: 'SENT' | 'RECEIVED' | 'SIGNED' | 'REJECTED' | 'REVOKED';
  occurredAt: string; // ISO 8601
  documentId: string;
}

/** Raw event from GET /documents/timeline (backend TimelineEventDto). */
export interface TimelineEventResponse {
  event_id: string;
  document_id: string;
  document_name: string;
  action: string;
  occurred_at: string;
  direction: 'sent' | 'received';
  other_party_name: string | null;
  other_party_email: string;
}

/** GET /documents/timeline response wrapper. */
export interface TimelineListResponse {
  items: TimelineEventResponse[];
}

// ──────────────────────────────────────────────
// Contacts
// ──────────────────────────────────────────────

/** DTO sent to POST /contacts (CreateContactDto). */
export interface CreateContactDto {
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_user_id?: string;
}

/** Shape returned by GET /contacts and POST /contacts (ContactResponseDto). */
export interface ContactResponse {
  id: string;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_user_id: string | null;
  created_at: string;
}

// ──────────────────────────────────────────────
// User search
// ──────────────────────────────────────────────

/** Shape returned by GET /users/search?q= (UserSearchResultDto). */
export interface UserSearchResult {
  id: string;
  name: string;
  last_name: string;
  email: string;
}

// ──────────────────────────────────────────────
// Document upload / send
// ──────────────────────────────────────────────

/** DTO sent to POST /documents (CreateDocumentDto). */
export interface CreateDocumentDto {
  title: string;
  description?: string;
}

/** Shape returned by POST /documents (upload). */
export interface UploadDocumentResponse {
  id: string;
  title: string;
}

/** DTO sent to POST /documents/:id/send (SendDocumentDto). */
export interface SendDocumentDto {
  recipients: SendDocumentRecipientDto[];
}

export interface SendDocumentRecipientDto {
  recipient_email: string;
  recipient_name?: string;
  user_id?: string;
}

/** Shape returned by POST /documents/:id/send. */
export interface SendDocumentResponse {
  document_id: string;
  status: string;
  recipients: {
    id: string;
    recipient_email: string;
    signing_status: string;
  }[];
}

/** DTO sent to PATCH /users/me : all fields optional. */
export interface UpdateUserDto {
  /** Required by backend to route the UUID-bound resource. */
  patient_id?: string;
  name?: string;
  last_name?: string;
  country?: string;
  national_id?: string | null;
  passport?: string | null;
  email?: string;
  phone_number?: string;
  /** Required when changing email, phone_number, or password. */
  current_password?: string;
  /** New password : requires current_password + confirm_new_password. */
  new_password?: string;
  /** Must match new_password. */
  confirm_new_password?: string;
}
