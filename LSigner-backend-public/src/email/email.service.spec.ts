import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { render } from 'react-email';
import { EmailService } from './email.service';

// react-email render() uses dynamic imports internally, which requires
// --experimental-vm-modules in Jest. Mock it to avoid that requirement.
jest.mock('react-email', () => ({
  render: jest.fn().mockResolvedValue('<p>Mocked email</p>'),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                'email.host': 'smtp.ethereal.email',
                'email.port': 587,
                'email.user': 'test@ethereal.email',
                'email.password': 'test-password',
                'email.secure': false,
                'email.debug': false,
                'email.tlsRejectUnauthorized': true,
                'email.from': 'noreply@lsigner.com',
                'email.fromName': 'LSigner',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Helper to reconfigure with valid credentials
  function setupTransporter(): void {
    service.onModuleInit();
  }

  // Helper to spy on the internal nodemailer transporter
  function mockTransporterSendMail(): jest.SpyInstance {
    return jest
      .spyOn(
        (service as unknown as Record<string, unknown>).transporter as any,
        'sendMail',
      )
      .mockResolvedValue({});
  }

  describe('onModuleInit', () => {
    it('should create a transporter when credentials are present', () => {
      service.onModuleInit();
      expect(
        (service as unknown as Record<string, unknown>).transporter,
      ).toBeDefined();
    });

    it('should not create a transporter when credentials are missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      service.onModuleInit();
      expect(
        (service as unknown as Record<string, unknown>).transporter,
      ).toBeNull();
    });
  });

  describe('sendMail', () => {
    it('should log a warning when transporter is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      service.onModuleInit();

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not configured'),
      );
    });

    it('should send mail when transporter is configured', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          from: 'LSigner <noreply@lsigner.com>',
        }),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('sent successfully'),
      );
    });

    it('should handle multiple recipients as array', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendMail({
        to: ['alice@example.com', 'bob@example.com'],
        subject: 'Bulk',
        html: '<p>Hi</p>',
      });

      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['alice@example.com', 'bob@example.com'],
        }),
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send a welcome email with correct subject and recipients', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();
      const renderMock = render as jest.Mock;
      renderMock.mockClear();

      await service.sendWelcomeEmail('john@example.com', {
        username: 'John',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: 'Welcome to LSigner!',
          html: expect.any(String),
        }),
      );
      expect(renderMock).toHaveBeenCalledTimes(1);
    });

    it('should inject logo as CID attachment when logo buffer is loaded', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      // Force a logo buffer onto the private field
      const mockBuffer = Buffer.from('fake-png-data');
      (service as unknown as Record<string, unknown>).logoBuffer = mockBuffer;

      await service.sendWelcomeEmail('john@example.com', {
        username: 'John',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              content: mockBuffer,
              cid: 'logo',
              contentDisposition: 'inline',
            }),
          ]),
        }),
      );
    });

    it('should not inject logo attachment when logo buffer is null', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      // Ensure logoBuffer is null (default from constructor when file not found)
      (service as unknown as Record<string, unknown>).logoBuffer = null;

      await service.sendWelcomeEmail('john@example.com', {
        username: 'John',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: undefined,
        }),
      );
    });
  });

  describe('sendOtpEmail', () => {
    it('should send an OTP email with correct subject and code', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendOtpEmail('test@example.com', {
        code: '123456',
        expiresInMinutes: 5,
        actionDescription: 'sign a document',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Your verification code - LSigner',
          html: expect.any(String),
        }),
      );
    });
  });

  describe('sendReminder', () => {
    it('should send a reminder email with correct subject and recipient', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();
      const renderMock = render as jest.Mock;
      renderMock.mockClear();

      await service.sendReminder(
        'recipient@example.com',
        'NDA Document',
        'John Sender',
        'Jane Recipient',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: expect.stringContaining('Reminder'),
          html: expect.any(String),
        }),
      );
      expect(renderMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendUnshared', () => {
    it('should send an unshared email with correct subject and recipient', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendUnshared(
        'recipient@example.com',
        'Contract',
        'John Sender',
        'Alice Recipient',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: expect.stringContaining('removed'),
          html: expect.any(String),
        }),
      );
    });
  });

  describe('sendSignedNotification', () => {
    it('should send a signed notification with correct subject and owner email', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendSignedNotification(
        'owner@example.com',
        'Agreement',
        'Bob Signer',
        '2026-07-04',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          subject: expect.stringContaining('signed'),
          html: expect.any(String),
        }),
      );
    });
  });

  describe('sendRejectedNotification', () => {
    it('should send a rejected notification with correct subject and owner email', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendRejectedNotification(
        'owner@example.com',
        'Contract',
        'Alice Rejecter',
        '2026-07-04',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          subject: expect.stringContaining('rejected'),
          html: expect.any(String),
        }),
      );
    });
  });

  describe('sendRevokedNotification', () => {
    it('should send a revoked notification with correct subject and owner email', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendRevokedNotification(
        'owner@example.com',
        'Agreement',
        'Charlie Recipient',
        '2026-07-04',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          subject: expect.stringContaining('revoked'),
          html: expect.any(String),
        }),
      );
    });
  });

  describe('sendAccountDeleted', () => {
    it('should send an account deleted email with correct subject and recipient', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendAccountDeleted('user@example.com', 'David');

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('deleted'),
          html: expect.any(String),
        }),
      );
    });
  });

  describe('sendDocumentNotification', () => {
    it('should send a document notification with correct subject and recipients', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendDocumentNotification('alice@example.com', {
        recipientName: 'Alice',
        senderName: 'Bob',
        documentName: 'Contract',
        documentLink: 'https://lsigner.com/shared/tok-123',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: expect.stringContaining('shared a document'),
          html: expect.any(String),
        }),
      );
    });

    it('should still send when optional message is provided', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendDocumentNotification('alice@example.com', {
        recipientName: 'Alice',
        senderName: 'Bob',
        documentName: 'Contract',
        documentLink: 'https://lsigner.com/shared/tok-123',
        message: 'Please sign ASAP',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendDocumentCancelled', () => {
    it('should send a document cancelled email with correct subject', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendDocumentCancelled('recipient@example.com', {
        recipientName: 'Alice',
        senderName: 'Bob',
        documentName: 'Contract',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: expect.stringContaining('cancelled'),
          html: expect.any(String),
        }),
      );
    });

    it('should log a warning when transporter is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      service.onModuleInit();

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.sendDocumentCancelled('recipient@example.com', {
        recipientName: 'Alice',
        senderName: 'Bob',
        documentName: 'Contract',
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not configured'),
      );
    });
  });

  describe('sendRecipientExpired', () => {
    it('should send a recipient expired email with correct subject', async () => {
      setupTransporter();
      const sendMailSpy = mockTransporterSendMail();

      await service.sendRecipientExpired('owner@example.com', {
        ownerName: 'Bob',
        recipientName: 'Alice',
        documentName: 'Contract',
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          subject: expect.stringContaining('deleted'),
          html: expect.any(String),
        }),
      );
    });

    it('should log a warning when transporter is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      service.onModuleInit();

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.sendRecipientExpired('owner@example.com', {
        ownerName: 'Bob',
        recipientName: 'Alice',
        documentName: 'Contract',
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not configured'),
      );
    });
  });
});
