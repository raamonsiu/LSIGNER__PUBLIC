/**
 * API functions for contact management (CRUD).
 *
 * All functions use the shared `api` fetch client and throw `ApiError` on any
 * non-2xx response so callers can branch on `statusCode`, `validationMessages`, etc.
 */
import { api } from '@/lib/api';
import type { ContactResponse, CreateContactDto } from './types';

/**
 * GET /contacts : list authenticated user's contacts.
 * @param query Optional search term matching name, email, or phone.
 */
export async function getContactsApi(
  query?: string,
): Promise<ContactResponse[]> {
  if (query) {
    return api.get<ContactResponse[]>('/contacts', { params: { q: query } });
  }
  return api.get<ContactResponse[]>('/contacts');
}

/**
 * POST /contacts : create a new contact.
 * @param dto Contact creation payload matching CreateContactDto
 */
export async function createContactApi(
  dto: CreateContactDto,
): Promise<ContactResponse> {
  return api.post<ContactResponse>('/contacts', dto);
}

/**
 * DELETE /contacts/:id : delete a contact by ID.
 * @param contactId Contact UUID to delete
 */
export async function deleteContactApi(contactId: string): Promise<void> {
  const safeId = encodeURIComponent(contactId);
  await api.delete(`/contacts/${safeId}`);
}
