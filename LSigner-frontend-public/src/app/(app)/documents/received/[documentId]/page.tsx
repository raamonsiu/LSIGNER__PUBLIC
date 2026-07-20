'use client';

import { useParams } from 'next/navigation';
import ReceivedDocumentsPage from '../page';

export default function ReceivedDocumentByIdPage() {
  const params = useParams<{ documentId: string }>();
  return <ReceivedDocumentsPage initialDocumentId={params?.documentId} />;
}
