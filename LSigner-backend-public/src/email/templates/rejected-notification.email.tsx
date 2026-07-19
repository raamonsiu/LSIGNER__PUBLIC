import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface RejectedNotificationEmailProps {
  documentName: string;
  rejecterName: string;
  rejectedAt: string;
  ownerName?: string;
}

export const RejectedNotificationEmail = ({
  documentName,
  rejecterName,
  rejectedAt,
  ownerName,
}: RejectedNotificationEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Document Rejected"
    previewText={`${rejecterName} has rejected ${documentName}`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Document Rejected
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      Hello{ownerName ? ` ${ownerName}` : ''},
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      <strong>{rejecterName}</strong> has rejected{' '}
      <strong>{documentName}</strong> on {rejectedAt}.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      You can review the rejection details from your LSigner dashboard.
    </Text>
  </EmailLayout>
);
