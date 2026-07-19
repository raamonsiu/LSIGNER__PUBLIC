import { Document, DocumentStatus } from '../entities/document.entity';
import { DocumentRecipient } from '../entities/document-recipient.entity';
import { TimelineEventRow, TimelineEventDto } from './dto/timeline.dto';

// Sent Document Status Mapping 

/**
 * Maps internal DocumentStatus to the frontend's SentDocumentStatus contract.
 *
 *   DRAFT      -> 'DRAFT'
 *   SENT       -> 'WAITING'
 *   SUPERSEDED -> 'SUPERSEDED'
 *   VOIDED     -> 'VOIDED'
 */
export function mapSentStatus(status: DocumentStatus): string {
  if (status === DocumentStatus.SENT) {
    return 'WAITING';
  }
  return status; // DRAFT, SUPERSEDED, VOIDED map directly
}

//  Sent List Item 

export interface SentDocumentsListItem {
  id: string;
  document_name: string;
  file_size_bytes: number;
  sent_at: string;
  signed_at: string | null;
  final_recipient_name: string | null;
  status: string;
}

export function toSentListItem(doc: Document): SentDocumentsListItem {
  const firstRecipient = doc.recipients?.[0] ?? null;
  return {
    id: doc.id,
    document_name: doc.title,
    file_size_bytes: Number(doc.file_size),
    sent_at: doc.created_at.toISOString(),
    signed_at: null,
    final_recipient_name: firstRecipient?.recipient_email ?? null,
    status: mapSentStatus(doc.status),
  };
}

//  Received List Item 

export interface ReceivedDocumentsListItem {
  id: string;
  document_name: string;
  file_size_bytes: number;
  received_at: string;
  signed_at: string | null;
  expires_at: string | null;
  sender_name: string | null;
  sender_email: string;
  status: string;
}

export function toReceivedListItem(
  doc: Document,
  recipient: DocumentRecipient,
): ReceivedDocumentsListItem {
  const owner = doc.owner as
    | { name: string; last_name: string; email: string }
    | undefined;
  return {
    id: doc.id,
    document_name: doc.title,
    file_size_bytes: Number(doc.file_size),
    received_at: recipient.sent_at.toISOString(),
    signed_at: null,
    expires_at: null,
    sender_name: owner ? `${owner.name} ${owner.last_name}` : null,
    sender_email: owner?.email ?? '',
    status: recipient.signing_status,
  };
}

//  Sent Detail 

export interface SentDocumentRecipient {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  signing_status: string;
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
  status: string;
  sent_at: string;
  signed_at: string | null;
  final_recipient_name: string | null;
  created_at: string;
  updated_at: string;
  recipients: SentDocumentRecipient[];
}

export function toSentDetail(doc: Document): SentDocumentDetailResponse {
  const firstRecipient = doc.recipients?.[0] ?? null;
  return {
    id: doc.id,
    document_name: doc.title,
    description: doc.description,
    file_size_bytes: Number(doc.file_size),
    original_filename: doc.original_filename,
    mime_type: doc.mime_type,
    version: doc.version,
    status: mapSentStatus(doc.status),
    sent_at: doc.created_at.toISOString(),
    signed_at: null,
    final_recipient_name: firstRecipient?.recipient_email ?? null,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
    recipients: (doc.recipients ?? []).map((r) => ({
      id: r.id,
      recipient_email: r.recipient_email,
      recipient_name: r.recipient_name,
      sent_at: r.sent_at.toISOString(),
      signing_status: r.status,
      first_accessed_at: r.first_accessed_at?.toISOString() ?? null,
      last_accessed_at: r.last_accessed_at?.toISOString() ?? null,
      signed_at: null,
    })),
  };
}

//  Received Detail 

export interface ReceivedDocumentSender {
  id: string;
  name: string;
  email: string;
}

export interface ReceivedDocumentRecipientInfo {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  signing_status: string;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
  signed_at: string | null;
  rejected_at: string | null;
  revoked_at: string | null;
}

export interface ReceivedDocumentDetailResponse {
  id: string;
  document_name: string;
  description: string | null;
  file_size_bytes: number;
  original_filename: string;
  mime_type: string;
  version: number;
  status: string;
  received_at: string;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  sender: ReceivedDocumentSender;
  my_recipient: ReceivedDocumentRecipientInfo;
}

export function toReceivedDetail(
  doc: Document,
  userId: string,
): ReceivedDocumentDetailResponse {
  const owner = doc.owner as
    | { patient_id: string; name: string; last_name: string; email: string }
    | undefined;
  const myRecipient = (doc.recipients ?? []).find((r) => r.user_id === userId);

  // Determine received_at from my recipient's sent_at
  const receivedAt = myRecipient
    ? myRecipient.sent_at.toISOString()
    : doc.created_at.toISOString();

  return {
    id: doc.id,
    document_name: doc.title,
    description: doc.description,
    file_size_bytes: Number(doc.file_size),
    original_filename: doc.original_filename,
    mime_type: doc.mime_type,
    version: doc.version,
    status: myRecipient ? myRecipient.signing_status : doc.status,
    received_at: receivedAt,
    signed_at: null,
    expires_at: null,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
    sender: {
      id: owner?.patient_id ?? '',
      name: owner ? `${owner.name} ${owner.last_name}` : '',
      email: owner?.email ?? '',
    },
    my_recipient: myRecipient
      ? {
        id: myRecipient.id,
        recipient_email: myRecipient.recipient_email,
        recipient_name: myRecipient.recipient_name,
        signing_status: myRecipient.signing_status,
        first_accessed_at:
          myRecipient.first_accessed_at?.toISOString() ?? null,
        last_accessed_at: myRecipient.last_accessed_at?.toISOString() ?? null,
        signed_at: null,
        rejected_at: null,
        revoked_at: null,
      }
      : {
        id: '',
        recipient_email: '',
        recipient_name: null,
        signing_status: '',
        first_accessed_at: null,
        last_accessed_at: null,
        signed_at: null,
        rejected_at: null,
        revoked_at: null,
      },
  };
}

//  Timeline Event Mapping 

/**
 * Maps a raw UNION query row to the public TimelineEventDto shape.
 * occurred_at is always a string (::text cast in SQL).
 */
export function toTimelineEvent(row: TimelineEventRow): TimelineEventDto {
  return {
    event_id: row.event_id,
    document_id: row.document_id,
    document_name: row.document_name,
    action: row.action,
    occurred_at: row.occurred_at,
    direction: row.direction,
    other_party_name: row.other_party_name ?? null,
    other_party_email: row.other_party_email,
  };
}
