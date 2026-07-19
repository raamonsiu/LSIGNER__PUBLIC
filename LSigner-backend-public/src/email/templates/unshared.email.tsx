import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface UnsharedEmailProps {
  documentName: string;
  senderName: string;
  recipientName: string;
}

export const UnsharedEmail = ({
  documentName,
  senderName,
  recipientName,
}: UnsharedEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Document Access Removed"
    previewText={`Access to ${documentName} has been removed`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Document Access Removed
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
      <strong>{senderName}</strong> has removed your access to{' '}
      <strong>{documentName}</strong>.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      If you believe this was a mistake, please contact the document owner
      directly.
    </Text>
  </EmailLayout>
);
