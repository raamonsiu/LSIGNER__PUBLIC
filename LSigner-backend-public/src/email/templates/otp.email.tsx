import type React from 'react';
import { Section, Text, Heading } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface OtpEmailProps {
  code: string;
  expiresInMinutes: number;
  actionDescription: string;
}

export const OtpEmail = ({
  code,
  expiresInMinutes,
  actionDescription,
}: OtpEmailProps): React.JSX.Element => (
  <EmailLayout title="Verification Code" previewText="Your verification code">
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Your verification code
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      You requested a one-time code to <strong>{actionDescription}</strong>. Use
      the code below to complete this action:
    </Text>
    <Section
      style={{
        backgroundColor: '#f3f4f6',
        padding: '24px',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '24px',
      }}
    >
      <Text
        style={{
          fontSize: '36px',
          fontWeight: 'bold',
          letterSpacing: '8px',
          color: '#03045e',
          margin: '0',
          fontFamily: 'monospace',
        }}
      >
        {code}
      </Text>
    </Section>
    <Text
      style={{
        fontSize: '14px',
        lineHeight: '20px',
        color: '#9ca3af',
        margin: '0 0 24px',
        textAlign: 'center',
      }}
    >
      This code expires in {expiresInMinutes} minute
      {expiresInMinutes !== 1 ? 's' : ''}. If you did not request this code,
      please ignore this email. No action has been taken on your account.
    </Text>
  </EmailLayout>
);
