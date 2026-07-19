import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { render } from 'react-email';
import * as nodemailer from 'nodemailer';
import type { SendMailOptions } from './interfaces/send-mail-options.interface';
import { WelcomeEmail } from './templates/welcome.email';
import { DocumentSharedEmail } from './templates/document-shared.email';
import { DocumentCancelledEmail } from './templates/document-cancelled.email';
import { RecipientExpiredEmail } from './templates/recipient-expired.email';
import { OtpEmail } from './templates/otp.email';
import { ReminderEmail } from './templates/reminder.email';
import { UnsharedEmail } from './templates/unshared.email';
import { SignedNotificationEmail } from './templates/signed-notification.email';
import { RejectedNotificationEmail } from './templates/rejected-notification.email';
import { RevokedNotificationEmail } from './templates/revoked-notification.email';
import { AccountDeletedEmail } from './templates/account-deleted.email';

@Injectable()
export class EmailService implements OnModuleInit {
  // TODO: Allow per-use `from`/`fromName` overrides per email send context
  // (e.g. document notification should show the sender's name, not LSigner).
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private logoBuffer: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.loadLogo();

    const host = this.configService.get<string>('email.host');
    const port = this.configService.get<number>('email.port');
    const user = this.configService.get<string>('email.user');
    const password = this.configService.get<string>('email.password');
    const secure = this.configService.get<boolean>('email.secure');
    const debug = this.configService.get<boolean>('email.debug');
    const tlsRejectUnauthorized = this.configService.get<boolean>(
      'email.tlsRejectUnauthorized',
    );

    if (!host || !user || !password) {
      this.logger.warn(
        'SMTP credentials not fully configured. Email service will be inactive.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: tlsRejectUnauthorized },
      debug,
    });
  }

  /**
   * Reads the logo PNG from assets directory and stores the Buffer.
   * Gracefully degrades if the file is missing (only logs a warning).
   */
  private loadLogo(): void {
    const logoPath = join(__dirname, '..', '..', 'email', 'assets', 'logo.png');
    this.logger.log(`Looking for logo at: ${logoPath}`);

    if (existsSync(logoPath)) {
      this.logoBuffer = readFileSync(logoPath);
      this.logger.log(`Email logo loaded (${this.logoBuffer.length} bytes)`);
    } else {
      this.logger.warn(
        `Logo not found at ${logoPath} — emails will render without logo`,
      );
    }
  }

  private getDefaultFrom(): string {
    const from = this.configService.get<string>('email.from');
    const fromName = this.configService.get<string>('email.fromName');
    return fromName && from
      ? `${fromName} <${from}>`
      : (from ?? 'noreply@lsigner.com');
  }

  /**
   * Injects the logo as a CID attachment when the logo buffer is loaded.
   * Returns the options unchanged when no logo is available.
   */
  private autoInjectLogo(options: SendMailOptions): SendMailOptions {
    if (!this.logoBuffer) return options;

    const logoAttachment = {
      content: this.logoBuffer,
      cid: 'logo',
      contentType: 'image/png',
      contentDisposition: 'inline' as const,
    };

    return {
      ...options,
      attachments: options.attachments
        ? [...options.attachments, logoAttachment]
        : [logoAttachment],
    };
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const recipients = Array.isArray(options.to)
      ? options.to.join(', ')
      : options.to;

    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping sendMail to ${recipients}`,
      );
      return;
    }

    const resolvedOptions = this.autoInjectLogo(options);

    try {
      await this.transporter.sendMail({
        from: options.from ?? this.getDefaultFrom(),
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: resolvedOptions.attachments,
        replyTo: options.replyTo,
      });
      this.logger.log(`Email sent successfully to ${recipients}`);
    } catch (error) {
      // TODO: In production, implement a retry mechanism (BullMQ, Redis queue)
      // or re-throw so callers can decide fallback behaviour.
      this.logger.error(
        `Failed to send email to ${recipients}: ${(error as Error).message}`,
      );
    }
  }

  async sendWelcomeEmail(
    to: string,
    data: { username: string; ctaUrl?: string },
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping welcome email to ${to}`,
      );
      return;
    }

    const html = await render(
      <WelcomeEmail username={data.username} ctaUrl={data.ctaUrl} />,
    );

    await this.sendMail({
      to,
      subject: 'Welcome to LSigner!',
      html,
    });
  }

  async sendDocumentNotification(
    to: string,
    data: {
      recipientName: string;
      senderName: string;
      documentName: string;
      documentLink: string;
      message?: string;
    },
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping document email to ${to}`,
      );
      return;
    }

    const html = await render(
      <DocumentSharedEmail
        recipientName={data.recipientName}
        senderName={data.senderName}
        documentName={data.documentName}
        documentLink={data.documentLink}
        message={data.message}
      />,
    );

    await this.sendMail({
      to,
      subject: `${data.senderName} shared a document with you on LSigner`,
      html,
    });
  }

  async sendOtpEmail(
    to: string,
    data: {
      code: string;
      expiresInMinutes: number;
      actionDescription: string;
    },
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping OTP email to ${to}`,
      );
      return;
    }

    const html = await render(
      <OtpEmail
        code={data.code}
        expiresInMinutes={data.expiresInMinutes}
        actionDescription={data.actionDescription}
      />,
    );

    await this.sendMail({
      to,
      subject: 'Your verification code - LSigner',
      html,
    });
  }

  async sendReminder(
    email: string,
    documentName: string,
    senderName: string,
    recipientName: string,
    documentLink?: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping reminder email to ${email}`,
      );
      return;
    }

    const html = await render(
      <ReminderEmail
        documentName={documentName}
        senderName={senderName}
        recipientName={recipientName}
        documentLink={documentLink}
      />,
    );

    await this.sendMail({
      to: email,
      subject: `Reminder: ${documentName} is awaiting your signature`,
      html,
    });
  }

  async sendUnshared(
    email: string,
    documentName: string,
    senderName: string,
    recipientName: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping unshared email to ${email}`,
      );
      return;
    }

    const html = await render(
      <UnsharedEmail
        documentName={documentName}
        senderName={senderName}
        recipientName={recipientName}
      />,
    );

    await this.sendMail({
      to: email,
      subject: `Access to ${documentName} has been removed`,
      html,
    });
  }

  async sendSignedNotification(
    ownerEmail: string,
    documentName: string,
    signerName: string,
    signedAt: string,
    ownerName?: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping signed notification to ${ownerEmail}`,
      );
      return;
    }

    const formattedDate = new Date(signedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = await render(
      <SignedNotificationEmail
        documentName={documentName}
        signerName={signerName}
        signedAt={formattedDate}
        ownerName={ownerName}
      />,
    );

    await this.sendMail({
      to: ownerEmail,
      subject: `${signerName} has signed ${documentName}`,
      html,
    });
  }

  async sendRejectedNotification(
    ownerEmail: string,
    documentName: string,
    rejecterName: string,
    rejectedAt: string,
    ownerName?: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping rejected notification to ${ownerEmail}`,
      );
      return;
    }

    const formattedDate = new Date(rejectedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = await render(
      <RejectedNotificationEmail
        documentName={documentName}
        rejecterName={rejecterName}
        rejectedAt={formattedDate}
        ownerName={ownerName}
      />,
    );

    await this.sendMail({
      to: ownerEmail,
      subject: `${rejecterName} has rejected ${documentName}`,
      html,
    });
  }

  async sendRevokedNotification(
    ownerEmail: string,
    documentName: string,
    revokedByName: string,
    revokedAt: string,
    ownerName?: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping revoked notification to ${ownerEmail}`,
      );
      return;
    }

    const formattedDate = new Date(revokedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = await render(
      <RevokedNotificationEmail
        documentName={documentName}
        revokedByName={revokedByName}
        revokedAt={formattedDate}
        ownerName={ownerName}
      />,
    );

    await this.sendMail({
      to: ownerEmail,
      subject: `${revokedByName} has revoked their signature on ${documentName}`,
      html,
    });
  }

  async sendDocumentCancelled(
    to: string,
    data: {
      recipientName: string;
      senderName: string;
      documentName: string;
    },
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping document cancelled email to ${to}`,
      );
      return;
    }

    const html = await render(
      <DocumentCancelledEmail
        recipientName={data.recipientName}
        senderName={data.senderName}
        documentName={data.documentName}
      />,
    );

    await this.sendMail({
      to,
      subject: `Document cancelled — ${data.senderName} has deleted their account`,
      html,
    });
  }

  async sendRecipientExpired(
    to: string,
    data: {
      ownerName: string;
      recipientName: string;
      documentName: string;
    },
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping recipient expired email to ${to}`,
      );
      return;
    }

    const html = await render(
      <RecipientExpiredEmail
        ownerName={data.ownerName}
        recipientName={data.recipientName}
        documentName={data.documentName}
      />,
    );

    await this.sendMail({
      to,
      subject: `A recipient has deleted their account — ${data.recipientName} has left LSigner`,
      html,
    });
  }

  async sendAccountDeleted(email: string, userName: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Email transport not configured — skipping account deleted email to ${email}`,
      );
      return;
    }

    const html = await render(<AccountDeletedEmail userName={userName} />);

    await this.sendMail({
      to: email,
      subject: 'Your LSigner account has been deleted',
      html,
    });
  }
}
