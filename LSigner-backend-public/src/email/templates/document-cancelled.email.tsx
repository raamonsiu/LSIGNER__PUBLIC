import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface DocumentCancelledEmailProps {
  recipientName: string;
  senderName: string;
  documentName: string;
}

export const DocumentCancelledEmail = ({
  recipientName,
  senderName,
  documentName,
}: DocumentCancelledEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Document Cancelled"
    previewText={`${senderName} has cancelled "${documentName}"`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Document Cancelled
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      Hello {recipientName},
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      <strong>{senderName}</strong> has deleted their LSigner account. As a
      result, the document &quot;{documentName}&quot; has been cancelled. No
      action is needed on your part.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      If you have any questions, please contact the sender through other means.
    </Text>
  </EmailLayout>
);
