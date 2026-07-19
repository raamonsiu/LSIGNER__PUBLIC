import type React from 'react';
import { Section, Text, Button, Heading } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface ReminderEmailProps {
  documentName: string;
  senderName: string;
  recipientName: string;
  documentLink?: string;
}

export const ReminderEmail = ({
  documentName,
  senderName,
  recipientName,
  documentLink,
}: ReminderEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Document Reminder"
    previewText={`Reminder: ${documentName} is awaiting your signature`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Document Reminder
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
      This is a friendly reminder that <strong>{documentName}</strong> shared by{' '}
      <strong>{senderName}</strong> is awaiting your signature.
    </Text>
    {documentLink && (
      <Section style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button
          href={documentLink}
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
          View Document
        </Button>
      </Section>
    )}
    {!documentLink && (
      <Text
        style={{
          fontSize: '16px',
          lineHeight: '24px',
          color: '#5a6175',
          margin: '0',
        }}
      >
        Please log in to LSigner to review and sign the document.
      </Text>
    )}
  </EmailLayout>
);
