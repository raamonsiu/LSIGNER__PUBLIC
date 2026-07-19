import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface SignedNotificationEmailProps {
  documentName: string;
  signerName: string;
  signedAt: string;
  ownerName?: string;
}

export const SignedNotificationEmail = ({
  documentName,
  signerName,
  signedAt,
  ownerName,
}: SignedNotificationEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Document Signed"
    previewText={`${signerName} has signed ${documentName}`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Document Signed
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
      <strong>{signerName}</strong> has signed <strong>{documentName}</strong>{' '}
      on {signedAt}.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      You can view the signed document from your LSigner dashboard.
    </Text>
  </EmailLayout>
);
