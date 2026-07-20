import { api } from '@/lib/api';
import type {
  PublicDocumentActionDto,
  PublicDocumentMeResponse,
  SignedDocumentResult,
} from './types';

export async function getPublicDocumentMeApi(): Promise<PublicDocumentMeResponse> {
  return api.get<PublicDocumentMeResponse>('/v1/public/documents/me', {
    skipAuth: true,
  });
}

export async function signPublicDocumentApi(
  payload: PublicDocumentActionDto,
): Promise<SignedDocumentResult> {
  return api.post<SignedDocumentResult>(
    '/v1/public/documents/me/sign',
    payload,
    {
      skipAuth: true,
    },
  );
}

export async function rejectPublicDocumentApi(
  payload: PublicDocumentActionDto,
): Promise<void> {
  await api.post('/v1/public/documents/me/reject', payload, {
    skipAuth: true,
  });
}

export async function revokePublicDocumentApi(
  payload: PublicDocumentActionDto,
): Promise<void> {
  await api.post('/v1/public/documents/me/revoke', payload, {
    skipAuth: true,
  });
}
