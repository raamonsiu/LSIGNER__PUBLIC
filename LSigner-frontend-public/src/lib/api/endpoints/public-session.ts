import { api } from '@/lib/api';
import type { PublicSessionBootstrapResponse } from './types';

export async function bootstrapPublicSessionApi(
  publicLinkId: string,
): Promise<PublicSessionBootstrapResponse> {
  return api.post<PublicSessionBootstrapResponse>(
    '/v1/public/session/bootstrap',
    {
      publicLinkId,
    },
    { skipAuth: true },
  );
}

export async function logoutPublicSessionApi(): Promise<void> {
  await api.post('/v1/public/session/logout', {}, { skipAuth: true });
}
