import type React from 'react';
import { Section, Text, Button, Heading } from 'react-email';
import { EmailLayout } from './components/EmailLayout';

export interface DocumentSharedEmailProps {
  recipientName: string;
  senderName: string;
  documentName: string;
  documentLink: string;
  message?: string;
}

export const DocumentSharedEmail = ({
  recipientName,
  senderName,
  documentName,
  documentLink,
  message,
}: DocumentSharedEmailProps): React.JSX.Element => (
  <EmailLayout
    title="Document Shared"
    previewText={`${senderName} shared "${documentName}" with you on LSigner`}
  >
    <Heading
      as="h2"
      style={{
        fontSize: '24px',
        margin: '0 0 16px',
        color: '#151a35',
      }}
    >
      Hello, {recipientName}!
    </Heading>
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 16px',
      }}
    >
      <strong>{senderName}</strong> has shared a document with you on LSigner:
    </Text>
    <Section
      style={{
        backgroundColor: '#e5e5ef',
        padding: '16px',
        borderRadius: '6px',
        marginBottom: '24px',
      }}
    >
      <Text
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#151a35',
          margin: '0',
        }}
      >
        {documentName}
      </Text>
    </Section>
    {message && (
      <Text
        style={{
          fontSize: '14px',
          lineHeight: '20px',
          color: '#5a6175',
          fontStyle: 'italic',
          margin: '0 0 24px',
          padding: '12px',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
        }}
      >
        &ldquo;{message}&rdquo;
      </Text>
    )}
    <Text
      style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#5a6175',
        margin: '0 0 24px',
      }}
    >
      Click the button below to view and sign the document.
    </Text>
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
  </EmailLayout>
);
