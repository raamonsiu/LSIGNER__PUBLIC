// === Enums (mirror backend entities) ========================================

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  SUPERSEDED = 'SUPERSEDED',
  VOIDED = 'VOIDED',
}

export enum RecipientStatus {
  PENDING = 'PENDING',
  UPDATED = 'UPDATED',
}

// === Types ===================================================================

export interface MockUser {
  patient_id: string;
  name: string;
  last_name: string;
  email: string;
  country: string;
  phone_number: string;
  created_at: Date;
}

export interface MockRecipient {
  id: string;
  document_id: string;
  user_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  status: RecipientStatus;
  sent_at: Date;
}

export interface MockDocument {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  original_filename: string;
  mime_type: string;
  /** File size in bytes */
  file_size: number;
  status: DocumentStatus;
  version: number;
  parent_document_id: string | null;
  recipients: MockRecipient[];
  created_at: Date;
  updated_at: Date;
}

// === Helpers =================================================================

const now = new Date('2026-05-31T14:32:00Z');
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

// === Current user =============================================================

export const mockCurrentUser: MockUser = {
  patient_id: 'usr-a1b2c3d4-0000-0000-0000-000000000001',
  name: 'Adrián',
  last_name: 'García Martínez',
  email: 'adrian.garcia@example.com',
  country: 'Spain',
  phone_number: '+34600123456',
  created_at: new Date('2024-01-15T09:00:00Z'),
};

// === Mock documents ===========================================================

export const mockDocuments: MockDocument[] = [
  {
    id: 'doc-001',
    owner_id: mockCurrentUser.patient_id,
    title: 'Contrato de Arrendamiento : Local Comercial Q2 2025',
    description:
      'Contrato de arrendamiento para el local comercial en Calle Mayor 12, Madrid.',
    original_filename: 'contrato_arrendamiento_q2_2025.pdf',
    mime_type: 'application/pdf',
    file_size: 524_288,
    status: DocumentStatus.SENT,
    version: 1,
    parent_document_id: null,
    recipients: [
      {
        id: 'rec-001a',
        document_id: 'doc-001',
        user_id: null,
        recipient_email: 'maria.lopez@empresa.es',
        recipient_name: 'María López Fernández',
        status: RecipientStatus.PENDING,
        sent_at: daysAgo(2),
      },
      {
        id: 'rec-001b',
        document_id: 'doc-001',
        user_id: null,
        recipient_email: 'jc.ruiz@notaria.es',
        recipient_name: 'Juan Carlos Ruiz',
        status: RecipientStatus.PENDING,
        sent_at: daysAgo(2),
      },
    ],
    created_at: daysAgo(3),
    updated_at: daysAgo(2),
  },
  {
    id: 'doc-002',
    owner_id: mockCurrentUser.patient_id,
    title: 'Acuerdo de Confidencialidad : ABC Solutions',
    description: null,
    original_filename: 'nda_abc_solutions.pdf',
    mime_type: 'application/pdf',
    file_size: 204_800,
    status: DocumentStatus.SENT,
    version: 1,
    parent_document_id: null,
    recipients: [
      {
        id: 'rec-002a',
        document_id: 'doc-002',
        user_id: null,
        recipient_email: 'ceo@abc-solutions.com',
        recipient_name: 'Robert Müller',
        status: RecipientStatus.PENDING,
        sent_at: daysAgo(5),
      },
    ],
    created_at: daysAgo(6),
    updated_at: daysAgo(5),
  },
  {
    id: 'doc-003',
    owner_id: mockCurrentUser.patient_id,
    title: 'Poder Notarial : Gestión Inmobiliaria Barcelona',
    description:
      'Poder notarial para la gestión y venta de la propiedad en Barcelona.',
    original_filename: 'poder_notarial_inmobiliaria.pdf',
    mime_type: 'application/pdf',
    file_size: 307_200,
    status: DocumentStatus.SENT,
    version: 1,
    parent_document_id: null,
    recipients: [
      {
        id: 'rec-003a',
        document_id: 'doc-003',
        user_id: null,
        recipient_email: 'ana.rodriguez@notario.es',
        recipient_name: 'Ana Rodríguez Pérez',
        status: RecipientStatus.UPDATED,
        sent_at: daysAgo(10),
      },
    ],
    created_at: daysAgo(12),
    updated_at: daysAgo(8),
  },
  {
    id: 'doc-004',
    owner_id: mockCurrentUser.patient_id,
    title: 'Presupuesto Servicios TI 2025',
    description:
      'Propuesta económica para consultoría tecnológica y desarrollo.',
    original_filename: 'presupuesto_ti_2025.docx',
    mime_type:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    file_size: 102_400,
    status: DocumentStatus.DRAFT,
    version: 1,
    parent_document_id: null,
    recipients: [],
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
  {
    id: 'doc-005',
    owner_id: mockCurrentUser.patient_id,
    title: 'Contrato de Prestación de Servicios : Proyecto Delta',
    description: null,
    original_filename: 'contrato_servicios_delta.pdf',
    mime_type: 'application/pdf',
    file_size: 450_560,
    status: DocumentStatus.SENT,
    version: 1,
    parent_document_id: null,
    recipients: [
      {
        id: 'rec-005a',
        document_id: 'doc-005',
        user_id: null,
        recipient_email: 'carlos.mendez@delta.io',
        recipient_name: 'Carlos Méndez',
        status: RecipientStatus.UPDATED,
        sent_at: daysAgo(15),
      },
      {
        id: 'rec-005b',
        document_id: 'doc-005',
        user_id: null,
        recipient_email: 'laura.vega@delta.io',
        recipient_name: 'Laura Vega',
        status: RecipientStatus.UPDATED,
        sent_at: daysAgo(15),
      },
    ],
    created_at: daysAgo(18),
    updated_at: daysAgo(14),
  },
  {
    id: 'doc-006',
    owner_id: mockCurrentUser.patient_id,
    title: 'Addendum Contrato Marco : Revisión Cláusulas v1',
    description:
      'Modificación de cláusulas 4.2 y 7.1 del contrato marco original.',
    original_filename: 'addendum_contrato_marco_v1.pdf',
    mime_type: 'application/pdf',
    file_size: 163_840,
    status: DocumentStatus.SUPERSEDED,
    version: 1,
    parent_document_id: null,
    recipients: [],
    created_at: daysAgo(30),
    updated_at: daysAgo(20),
  },
  {
    id: 'doc-007',
    owner_id: mockCurrentUser.patient_id,
    title: 'Carta de Intención : Fusión Proyecto Beta',
    description: null,
    original_filename: 'carta_intencion_beta.pdf',
    mime_type: 'application/pdf',
    file_size: 81_920,
    status: DocumentStatus.VOIDED,
    version: 1,
    parent_document_id: null,
    recipients: [
      {
        id: 'rec-007a',
        document_id: 'doc-007',
        user_id: null,
        recipient_email: 'direccion@proyecto-beta.com',
        recipient_name: 'Dirección Beta S.L.',
        status: RecipientStatus.PENDING,
        sent_at: daysAgo(25),
      },
    ],
    created_at: daysAgo(28),
    updated_at: daysAgo(22),
  },
  {
    id: 'doc-008',
    owner_id: mockCurrentUser.patient_id,
    title: 'Informe de Auditoría Interna Q1 2025',
    description:
      'Revisión trimestral de cumplimiento y procedimientos internos.',
    original_filename: 'informe_auditoria_q1_2025.pdf',
    mime_type: 'application/pdf',
    file_size: 716_800,
    status: DocumentStatus.DRAFT,
    version: 1,
    parent_document_id: null,
    recipients: [],
    created_at: daysAgo(4),
    updated_at: daysAgo(4),
  },
];

// === Derived selectors ========================================================

/** Documents that are SENT and have at least one PENDING recipient (need action). */
export function getPendingDocuments(): MockDocument[] {
  return mockDocuments.filter(
    (doc) =>
      doc.status === DocumentStatus.SENT &&
      doc.recipients.some((r) => r.status === RecipientStatus.PENDING),
  );
}

/** Most recently updated documents, up to `limit`. */
export function getRecentDocuments(limit = 6): MockDocument[] {
  return [...mockDocuments]
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    .slice(0, limit);
}

export interface DocumentStats {
  total: number;
  pending: number;
  sent: number;
  drafts: number;
}

/** Aggregate counts for the stats row. */
export function getDocumentStats(): DocumentStats {
  return {
    total: mockDocuments.length,
    pending: getPendingDocuments().length,
    sent: mockDocuments.filter((d) => d.status === DocumentStatus.SENT).length,
    drafts: mockDocuments.filter((d) => d.status === DocumentStatus.DRAFT)
      .length,
  };
}

// === Received documents mock data =============================================

import type {
  ReceivedDocumentDetailResponse,
  ReceivedDocumentsListResponse,
} from './api/endpoints/types';

export const MOCK_RECEIVED_LIST: ReceivedDocumentsListResponse = {
  stats: {
    total_received: 5,
    pending_my_signature: 2,
    signed_by_me: 2,
    rejected_or_revoked: 1,
  },
  items: [
    {
      id: 'recv-001',
      document_name: 'NDA : Confidencialidad ABC Corp',
      file_size_bytes: 204800,
      received_at: daysAgo(1).toISOString(),
      signed_at: null,
      expires_at: daysAgo(-13).toISOString(),
      sender_name: 'María López Fernández',
      sender_email: 'maria.lopez@empresa.es',
      status: 'PENDING',
    },
    {
      id: 'recv-002',
      document_name: 'Contrato de Servicios Profesionales',
      file_size_bytes: 524288,
      received_at: daysAgo(3).toISOString(),
      signed_at: null,
      expires_at: daysAgo(-10).toISOString(),
      sender_name: 'Carlos Méndez',
      sender_email: 'carlos.mendez@delta.io',
      status: 'PENDING',
    },
    {
      id: 'recv-003',
      document_name: 'Acuerdo Comercial : Proveedores 2026',
      file_size_bytes: 307200,
      received_at: daysAgo(7).toISOString(),
      signed_at: daysAgo(5).toISOString(),
      expires_at: null,
      sender_name: 'Ana Rodríguez Pérez',
      sender_email: 'ana.rodriguez@notario.es',
      status: 'SIGNED',
    },
    {
      id: 'recv-004',
      document_name: 'Renovación Póliza Seguro Q3',
      file_size_bytes: 102400,
      received_at: daysAgo(14).toISOString(),
      signed_at: daysAgo(10).toISOString(),
      expires_at: null,
      sender_name: 'Laura Vega',
      sender_email: 'laura.vega@delta.io',
      status: 'SIGNED',
    },
    {
      id: 'recv-005',
      document_name: 'Propuesta Comercial : Proyecto Alfa',
      file_size_bytes: 450560,
      received_at: daysAgo(20).toISOString(),
      signed_at: null,
      expires_at: null,
      sender_name: null,
      sender_email: 'comercial@proyecto-alfa.com',
      status: 'REJECTED',
    },
  ],
};

export const MOCK_RECEIVED_DETAILS: Record<
  string,
  ReceivedDocumentDetailResponse
> = {
  'recv-001': {
    id: 'recv-001',
    document_name: 'NDA : Confidencialidad ABC Corp',
    description:
      'Acuerdo de confidencialidad para intercambio de información técnica con ABC Corp.',
    file_size_bytes: 204800,
    original_filename: 'nda_abc_corp.pdf',
    mime_type: 'application/pdf',
    version: 1,
    status: 'PENDING',
    received_at: daysAgo(1).toISOString(),
    signed_at: null,
    expires_at: daysAgo(-13).toISOString(),
    created_at: daysAgo(2).toISOString(),
    updated_at: daysAgo(1).toISOString(),
    sender: {
      id: 'user-002',
      name: 'María López Fernández',
      email: 'maria.lopez@empresa.es',
      deleted: false,
    },
    my_recipient: {
      id: 'rec-001-user',
      recipient_email: 'adrian.garcia@example.com',
      recipient_name: 'Adrián García Martínez',
      signing_status: 'PENDING',
      first_accessed_at: daysAgo(1).toISOString(),
      last_accessed_at: daysAgo(0).toISOString(),
      signed_at: null,
      rejected_at: null,
      revoked_at: null,
    },
  },
  'recv-002': {
    id: 'recv-002',
    document_name: 'Contrato de Servicios Profesionales',
    description:
      'Contrato marco para prestación de servicios de consultoría tecnológica.',
    file_size_bytes: 524288,
    original_filename: 'contrato_servicios_profesionales.pdf',
    mime_type: 'application/pdf',
    version: 1,
    status: 'PENDING',
    received_at: daysAgo(3).toISOString(),
    signed_at: null,
    expires_at: daysAgo(-10).toISOString(),
    created_at: daysAgo(4).toISOString(),
    updated_at: daysAgo(3).toISOString(),
    sender: {
      id: 'user-003',
      name: 'Carlos Méndez',
      email: 'carlos.mendez@delta.io',
      deleted: false,
    },
    my_recipient: {
      id: 'rec-002-user',
      recipient_email: 'adrian.garcia@example.com',
      recipient_name: 'Adrián García Martínez',
      signing_status: 'PENDING',
      first_accessed_at: null,
      last_accessed_at: null,
      signed_at: null,
      rejected_at: null,
      revoked_at: null,
    },
  },
  'recv-003': {
    id: 'recv-003',
    document_name: 'Acuerdo Comercial : Proveedores 2026',
    description: null,
    file_size_bytes: 307200,
    original_filename: 'acuerdo_comercial_proveedores_2026.pdf',
    mime_type: 'application/pdf',
    version: 1,
    status: 'SIGNED',
    received_at: daysAgo(7).toISOString(),
    signed_at: daysAgo(5).toISOString(),
    expires_at: null,
    created_at: daysAgo(8).toISOString(),
    updated_at: daysAgo(5).toISOString(),
    sender: {
      id: 'user-004',
      name: 'Ana Rodríguez Pérez',
      email: 'ana.rodriguez@notario.es',
      deleted: false,
    },
    my_recipient: {
      id: 'rec-003-user',
      recipient_email: 'adrian.garcia@example.com',
      recipient_name: 'Adrián García Martínez',
      signing_status: 'SIGNED',
      first_accessed_at: daysAgo(6).toISOString(),
      last_accessed_at: daysAgo(5).toISOString(),
      signed_at: daysAgo(5).toISOString(),
      rejected_at: null,
      revoked_at: null,
    },
  },
  'recv-004': {
    id: 'recv-004',
    document_name: 'Renovación Póliza Seguro Q3',
    description:
      'Documento de renovación anual de la póliza de seguro multirriesgo.',
    file_size_bytes: 102400,
    original_filename: 'renovacion_poliza_q3.pdf',
    mime_type: 'application/pdf',
    version: 1,
    status: 'SIGNED',
    received_at: daysAgo(14).toISOString(),
    signed_at: daysAgo(10).toISOString(),
    expires_at: null,
    created_at: daysAgo(15).toISOString(),
    updated_at: daysAgo(10).toISOString(),
    sender: {
      id: 'user-005',
      name: 'Laura Vega',
      email: 'laura.vega@delta.io',
      deleted: false,
    },
    my_recipient: {
      id: 'rec-004-user',
      recipient_email: 'adrian.garcia@example.com',
      recipient_name: 'Adrián García Martínez',
      signing_status: 'SIGNED',
      first_accessed_at: daysAgo(12).toISOString(),
      last_accessed_at: daysAgo(10).toISOString(),
      signed_at: daysAgo(10).toISOString(),
      rejected_at: null,
      revoked_at: null,
    },
  },
  'recv-005': {
    id: 'recv-005',
    document_name: 'Propuesta Comercial : Proyecto Alfa',
    description: null,
    file_size_bytes: 450560,
    original_filename: 'propuesta_comercial_alfa.pdf',
    mime_type: 'application/pdf',
    version: 1,
    status: 'REJECTED',
    received_at: daysAgo(20).toISOString(),
    signed_at: null,
    expires_at: null,
    created_at: daysAgo(21).toISOString(),
    updated_at: daysAgo(18).toISOString(),
    sender: {
      id: 'user-006',
      name: null as unknown as string,
      email: 'comercial@proyecto-alfa.com',
      deleted: false,
    },
    my_recipient: {
      id: 'rec-005-user',
      recipient_email: 'adrian.garcia@example.com',
      recipient_name: 'Adrián García Martínez',
      signing_status: 'REJECTED',
      first_accessed_at: daysAgo(19).toISOString(),
      last_accessed_at: daysAgo(18).toISOString(),
      signed_at: null,
      rejected_at: daysAgo(18).toISOString(),
      revoked_at: null,
    },
  },
};

// === Formatting helpers =======================================================

/** Human-readable file size string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

/** Relative date string in Spanish (e.g. "hace 2 días", "ayer"). */
export function formatRelativeDate(date: Date): string {
  const refNow = new Date('2026-05-31T14:32:00Z');
  const diffMs = refNow.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Time-of-day greeting in Spanish. */
export function getGreeting(): string {
  const hour = new Date('2026-05-31T14:32:00Z').getUTCHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
