import type React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Img,
  Preview,
} from 'react-email';

export interface EmailLayoutProps {
  children: React.ReactNode;
  title?: string;
  previewText?: string;
}

export const EmailLayout = ({
  children,
  title,
  previewText,
}: EmailLayoutProps): React.JSX.Element => (
  <Html>
    <Head>{title && <title>{title}</title>}</Head>
    {previewText && <Preview>{previewText}</Preview>}
    <Body
      style={{
        fontFamily: 'sans-serif',
        backgroundColor: '#f3f4f6',
        margin: 0,
        padding: 0,
      }}
    >
      <Container
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px 0',
        }}
      >
        {/* Navy header */}
        <Section
          style={{
            backgroundColor: '#03045e',
            padding: '24px',
            textAlign: 'center',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Img
            src="cid:logo"
            width={60}
            alt="LSigner"
            style={{ margin: '0 auto' }}
          />
          <Text
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#ffffff',
              margin: '8px 0 0 0',
            }}
          >
            LSigner
          </Text>
        </Section>

        {/* White body */}
        <Section
          style={{
            padding: '32px',
            backgroundColor: '#ffffff',
          }}
        >
          {children}
        </Section>

        {/* Gray footer */}
        <Section
          style={{
            backgroundColor: '#e5e7eb',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <Text
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              margin: '0 0 4px 0',
            }}
          >
            &copy; {new Date().getFullYear()} LSigner. All rights reserved.
          </Text>
          <Text
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              margin: '0',
            }}
          >
            This is an automated message. Please do not reply.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);
