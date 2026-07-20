import type {
  PrivateDocumentLockStatus,
  SharedDocumentLockStatus,
} from '@/lib/api/endpoints/types';

export function normalizePrivateDocumentLock(
  lock: PrivateDocumentLockStatus,
  currentRecipientId?: string,
  currentRecipientEmail?: string,
): SharedDocumentLockStatus {
  if (
    typeof (lock as unknown as Record<string, unknown>).is_resolved ===
    'boolean'
  ) {
    return {
      id: lock.id,
      lock_type: lock.lock_type,
      is_resolved: (lock as unknown as Record<string, unknown>)
        .is_resolved as boolean,
      resolved_at:
        ((lock as unknown as Record<string, unknown>).resolved_at as
          | string
          | null) ?? null,
    };
  }

  const lockAny = lock as unknown as Record<string, unknown>;
  const recipientResolutions = (lockAny.recipients ??
    lockAny.recipient_resolutions ??
    []) as Array<{
    recipient_id: string;
    recipient_email: string;
    is_resolved: boolean;
    resolved_at: string | null;
  }>;

  const matchedByRecipientId = currentRecipientId
    ? recipientResolutions.find(
        (resolution) => resolution.recipient_id === currentRecipientId,
      )
    : undefined;

  const matchedByEmail = currentRecipientEmail
    ? recipientResolutions.find(
        (resolution) => resolution.recipient_email === currentRecipientEmail,
      )
    : undefined;

  const matchedResolution = matchedByRecipientId ?? matchedByEmail;

  return {
    id: lock.id,
    lock_type: lock.lock_type,
    is_resolved: matchedResolution?.is_resolved ?? false,
    resolved_at: matchedResolution?.resolved_at ?? null,
  };
}
