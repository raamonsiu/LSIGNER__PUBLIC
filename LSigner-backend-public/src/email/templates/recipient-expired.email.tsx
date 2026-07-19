import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface RecipientExpiredEmailProps {
  ownerName: string;
  recipientName: string;
  documentName: string;
}

export const RecipientExpiredEmail = ({
  ownerName,
  recipientName,
  documentName,
}: RecipientExpiredEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Recipient Account Deleted"
    previewText={`${recipientName} has deleted their account — signature line expired`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Recipient Account Deleted
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      Hello {ownerName},
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      <strong>{recipientName}</strong> has deleted their LSigner account. Their
      signature line on the document &quot;{documentName}&quot; has been marked
      as expired. Other recipients can continue with the signing process.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      No action is needed on your part.
    </Text>
  </EmailLayout>
);
