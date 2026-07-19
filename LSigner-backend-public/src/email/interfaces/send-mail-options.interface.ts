export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename?: string;
    content: Buffer | string;
    contentType?: string;
    cid?: string;
    contentDisposition?: 'inline' | 'attachment';
  }>;
  from?: string;
  replyTo?: string;
}
