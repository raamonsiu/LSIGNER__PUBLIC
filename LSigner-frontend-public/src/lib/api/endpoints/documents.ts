import { api, API_BASE_URL, getToken, triggerRefresh } from '@/lib/api';
import type {
  ReceivedDocumentDetailResponse,
  ReceivedDocumentsListResponse,
  ReceivedDocumentViewUrlResponse,
  SendDocumentDto,
  SendDocumentResponse,
  SentDocumentDetailResponse,
  SentDocumentsListResponse,
  SentRecipientsListResponse,
  TimelineListResponse,
  UploadDocumentResponse,
} from './types';

/**
 * GET /documents/sent : lightweight payload for Sent Documents list + metrics.
 */
export async function getSentDocumentsApi(): Promise<SentDocumentsListResponse> {
  return api.get<SentDocumentsListResponse>('/documents/sent');
}

/**
 * GET /documents/sent/recipients : per-recipient payload for Sent Documents list.
 * Returns one row per DocumentRecipient owned by the authenticated user.
 */
export async function getSentRecipientsApi(): Promise<SentRecipientsListResponse> {
  return api.get<SentRecipientsListResponse>('/documents/sent/recipients');
}

/**
 * GET /documents/sent/:id : full detail payload for one sent document.
 */
export async function getSentDocumentByIdApi(
  documentId: string,
): Promise<SentDocumentDetailResponse> {
  const safeDocumentId = encodeURIComponent(documentId);
  return api.get<SentDocumentDetailResponse>(
    `/documents/sent/${safeDocumentId}`,
  );
}

/**
 * POST /documents/:id/recipients/:recipientId/reminder : notify a recipient.
 * Backend contract is pending; frontend integration is prepared for next ticket.
 */
export async function sendSentDocumentReminderApi(
  documentId: string,
  recipientId: string,
): Promise<void> {
  const safeDocumentId = encodeURIComponent(documentId);
  const safeRecipientId = encodeURIComponent(recipientId);
  await api.post(
    `/documents/${safeDocumentId}/recipients/${safeRecipientId}/reminder`,
  );
}

/**
 * DELETE /documents/:id/recipients/:recipientId/shared-access : owner revokes recipient access.
 */
export async function deleteSentDocumentSharedAccessApi(
  documentId: string,
  recipientId: string,
): Promise<void> {
  const safeDocumentId = encodeURIComponent(documentId);
  const safeRecipientId = encodeURIComponent(recipientId);
  await api.delete(
    `/documents/${safeDocumentId}/recipients/${safeRecipientId}/shared-access`,
  );
}

/**
 * GET /documents/:id/download : fetches the document binary blob using a
 * raw `fetch` (not the api client) because the response is binary, not JSON.
 *
 * Reads the access token directly from localStorage so this works outside the
 * React component lifecycle (e.g. from non-component code).
 *
 * @throws Error('DOWNLOAD_FAILED_401') when the backend returns 401.
 * @throws Error('DOWNLOAD_FAILED') on network errors or non-2xx responses.
 */
export async function fetchDocumentDownloadBlobUrl(
  documentId: string,
): Promise<Blob> {
  const safeDocumentId = encodeURIComponent(documentId);

  const token = await getToken();

  if (!token) {
    throw new Error('DOWNLOAD_FAILED_401');
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/documents/${safeDocumentId}/download`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      },
    );
  } catch {
    throw new Error('DOWNLOAD_FAILED');
  }

  if (response.status === 401) {
    const refreshed = await triggerRefresh();

    if (refreshed) {
      const freshToken = await getToken();

      if (!freshToken) {
        throw new Error('DOWNLOAD_FAILED_401');
      }

      let retryResponse: Response;
      try {
        retryResponse = await fetch(
          `${API_BASE_URL}/documents/${safeDocumentId}/download`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${freshToken}` },
            credentials: 'include',
          },
        );
      } catch {
        throw new Error('DOWNLOAD_FAILED');
      }

      if (!retryResponse.ok) {
        throw new Error('DOWNLOAD_FAILED');
      }

      return retryResponse.blob();
    }

    throw new Error('DOWNLOAD_FAILED_401');
  }

  if (!response.ok) {
    throw new Error('DOWNLOAD_FAILED');
  }

  return response.blob();
}

/**
 * NOTE: getSentDocumentViewUrlApi was removed.
 * Sent document "View document" now uses the blob-download endpoint
 * via fetchDocumentDownloadBlobUrl (see above).
 * If a view-url endpoint is implemented later, re-add here.
 */

/**
 * GET /documents/received : lightweight payload for Received Documents list + metrics.
 */
export async function getReceivedDocumentsApi(): Promise<ReceivedDocumentsListResponse> {
  return api.get<ReceivedDocumentsListResponse>('/documents/received');
}

/**
 * GET /documents/received/:id : full detail payload for one received document.
 */
export async function getReceivedDocumentByIdApi(
  documentId: string,
): Promise<ReceivedDocumentDetailResponse> {
  const safeDocumentId = encodeURIComponent(documentId);
  return api.get<ReceivedDocumentDetailResponse>(
    `/documents/received/${safeDocumentId}`,
  );
}

/**
 * GET /documents/received/:id/view-url : returns a browser-viewable URL.
 */
export async function getReceivedDocumentViewUrlApi(
  documentId: string,
): Promise<ReceivedDocumentViewUrlResponse> {
  const safeDocumentId = encodeURIComponent(documentId);
  return api.get<ReceivedDocumentViewUrlResponse>(
    `/documents/received/${safeDocumentId}/view-url`,
  );
}

/**
 * POST /documents : upload a new document with multipart/form-data.
 * @param file The binary file to upload
 * @param title Document title (derived from filename, required by backend)
 * @param description Optional document description
 */
export async function uploadDocumentApi(
  file: File,
  title: string,
  description?: string,
): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  if (description) {
    formData.append('description', description);
  }

  return api.post<UploadDocumentResponse>('/documents', formData, {
    raw: true,
  });
}

/**
 * POST /documents/:id/send : send a document to the listed recipients.
 * @param documentId The document UUID
 * @param dto Recipient list payload matching SendDocumentDto
 */
export async function sendDocumentApi(
  documentId: string,
  dto: SendDocumentDto,
): Promise<SendDocumentResponse> {
  const safeDocumentId = encodeURIComponent(documentId);
  return api.post<SendDocumentResponse>(
    `/documents/${safeDocumentId}/send`,
    dto,
  );
}

/**
 * PATCH /documents/:id : update document metadata (title, description).
 * Uses multipart/form-data to match backend's FileInterceptor.
 * @param documentId The document UUID
 * @param dto Partial update payload (title?, description?)
 */
export async function updateDocumentApi(
  documentId: string,
  dto: { title?: string; description?: string },
): Promise<void> {
  const safeDocumentId = encodeURIComponent(documentId);
  const formData = new FormData();
  if (dto.title !== undefined) formData.append('title', dto.title);
  if (dto.description !== undefined)
    formData.append('description', dto.description);

  await api.patch(`/documents/${safeDocumentId}`, formData, { raw: true });
}

/**
 * GET /documents/timeline : unified chronological feed of all document events
 * (sent + received) for the authenticated user.
 */
export async function getTimelineApi(): Promise<TimelineListResponse> {
  return api.get<TimelineListResponse>('/documents/timeline');
}
