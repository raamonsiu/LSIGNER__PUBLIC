import type React from 'react';
import { Section, Text, Button, Heading } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface WelcomeEmailProps {
  username: string;
  ctaUrl?: string;
}

export const WelcomeEmail = ({
  username,
  ctaUrl,
}: WelcomeEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Welcome to LSigner"
    previewText={`Welcome, ${username}! Start signing documents today.`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Welcome, {username}!
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      We&apos;re excited to have you onboard at <strong>LSigner</strong>.
    </Text>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 24px',
      }}
    >
      You can now upload documents, send them to recipients, and manage the
      entire signing process from your dashboard.
    </Text>
    {ctaUrl && (
      <Section style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button
          href={ctaUrl}
          style={{
            backgroundColor: '#f59e0b',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            display: 'inline-block',
          }}
        >
          Get Started
        </Button>
      </Section>
    )}
  </EmailLayout>
);
