import type React from 'react';
import { Heading, Text } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface AccountDeletedEmailProps {
  userName: string;
}

export const AccountDeletedEmail = ({
  userName,
}: AccountDeletedEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Account Deleted"
    previewText="Your LSigner account has been deleted"
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Account Deleted
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      Hello {userName},
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      Your LSigner account has been deleted as requested. All your data has been
      permanently removed.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0',
      }}
    >
      If you did not request this deletion, please contact our support team
      immediately.
    </Text>
  </EmailLayout>
);
