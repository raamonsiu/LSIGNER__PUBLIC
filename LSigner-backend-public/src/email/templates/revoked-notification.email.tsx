import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface RevokedNotificationEmailProps {
  documentName: string;
  revokedByName: string;
  revokedAt: string;
  ownerName?: string;
}

export const RevokedNotificationEmail = ({
  documentName,
  revokedByName,
  revokedAt,
  ownerName,
}: RevokedNotificationEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Signature Revoked"
    previewText={`${revokedByName} has revoked their signature on ${documentName}`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Signature Revoked
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
      <strong>{revokedByName}</strong> has revoked their signature on{' '}
      <strong>{documentName}</strong> on {revokedAt}.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      You can review the updated document status from your LSigner dashboard.
    </Text>
  </EmailLayout>
);
