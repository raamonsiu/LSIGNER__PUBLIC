import { api } from '@/lib/api';
import type {
  PrivateDocumentLockStatus,
  ResolveLockDto,
  SharedDocumentLockStatus,
} from './types';

export async function getPrivateDocumentLocksApi(
  documentId: string,
): Promise<PrivateDocumentLockStatus[]> {
  const safeDocumentId = encodeURIComponent(documentId);
  return api.get<PrivateDocumentLockStatus[]>(
    `/documents/received/${safeDocumentId}/locks`,
  );
}

export async function resolvePrivateDocumentLockApi(
  documentId: string,
  lockId: string,
  password: string,
): Promise<void> {
  const safeDocumentId = encodeURIComponent(documentId);
  const safeLockId = encodeURIComponent(lockId);
  const payload: ResolveLockDto = { password };
  await api.post(
    `/documents/${safeDocumentId}/locks/${safeLockId}/resolve`,
    payload,
  );
}

export async function getPublicDocumentLocksApi(): Promise<
  SharedDocumentLockStatus[]
> {
  return api.get<SharedDocumentLockStatus[]>('/v1/public/documents/me/locks', {
    skipAuth: true,
  });
}

export async function resolvePublicDocumentLockApi(
  lockId: string,
  password: string,
): Promise<void> {
  const safeLockId = encodeURIComponent(lockId);
  const payload: ResolveLockDto = { password };
  await api.post(
    `/v1/public/documents/me/locks/${safeLockId}/resolve`,
    payload,
    { skipAuth: true },
  );
}
