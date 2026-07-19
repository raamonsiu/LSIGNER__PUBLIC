import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { OtpPublicController } from './otp-public.controller';
import { OtpService } from './otp.service';
import { OtpAuthContext } from './enums/otp-auth-context.enum';
import { OtpActionType } from './enums/otp-action-type.enum';
import { OtpResourceType } from './enums/otp-resource-type.enum';
import { EmailService } from '../email/email.service';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import { PublicSessionGuard } from '../public-access/guards/public-session.guard';
import type { Request } from 'express';
import type { PublicSessionContext } from '../public-access/public-session.types';

const RECIPIENT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const RESOURCE_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';
const SESSION_DOCUMENT_ID = RESOURCE_ID;

describe('OtpPublicController', () => {
  let controller: OtpPublicController;
  let em: {
    transaction: jest.Mock;
  };
  let otpService: {
    createChallenge: jest.Mock;
    verifyChallenge: jest.Mock;
    resendChallenge: jest.Mock;
    resolvePublicChallengeContext: jest.Mock;
    getTtlSeconds: jest.Mock;
  };
  let documentSigningService: {
    validateDocumentAction: jest.Mock;
    executeOtpActionByRecipientId: jest.Mock;
  };
  let emailService: {
    sendOtpEmail: jest.Mock;
  };

  beforeEach(async () => {
    em = {
      transaction: jest.fn((cb: (em: unknown) => unknown) => cb(em)),
    };

    otpService = {
      createChallenge: jest.fn(),
      verifyChallenge: jest.fn(),
      resendChallenge: jest.fn(),
      resolvePublicChallengeContext: jest.fn(),
      getTtlSeconds: jest.fn().mockReturnValue(300),
    };

    documentSigningService = {
      validateDocumentAction: jest.fn(),
      executeOtpActionByRecipientId: jest.fn(),
    };

    emailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OtpPublicController],
      providers: [
        { provide: OtpService, useValue: otpService },
        { provide: DocumentSigningService, useValue: documentSigningService },
        { provide: EmailService, useValue: emailService },
        { provide: getEntityManagerToken(), useValue: em },
      ],
    })
      .overrideGuard(PublicSessionGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get(OtpPublicController);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates challenge with PUBLIC_SESSION auth context', async () => {
    otpService.resolvePublicChallengeContext.mockResolvedValue({
      signingStatus: 'PENDING',
      documentStatus: 'SENT',
      email: 'john@example.com',
    });
    otpService.createChallenge.mockResolvedValue({
      challenge: { id: 'challenge-uuid' },
      plainOtp: '123456',
      response: {
        challengeId: 'challenge-uuid',
        expiresAt: new Date().toISOString(),
        resendAvailableAt: new Date().toISOString(),
        maskedDestination: 'j***@example.com',
        remainingAttempts: 5,
        remainingResends: 3,
      },
    });

    const publicSession: PublicSessionContext = {
      sessionId: 'session-uuid',
      recipientId: RECIPIENT_ID,
      documentId: SESSION_DOCUMENT_ID,
      recipientEmail: 'john@example.com',
      expiresAt: new Date(),
    };

    const result = await controller.createChallenge(
      {
        actionType: OtpActionType.SIGN,
        resourceType: OtpResourceType.DOCUMENT,
        resourceId: RESOURCE_ID,
      },
      publicSession,
      { ip: '127.0.0.1', get: jest.fn() } as unknown as Request,
    );

    expect(result.challengeId).toBe('challenge-uuid');
    expect(otpService.createChallenge).toHaveBeenCalledWith(
      RECIPIENT_ID,
      expect.any(Object),
      expect.objectContaining({
        authContext: OtpAuthContext.PUBLIC_SESSION,
        actionDescription: 'sign a document',
      }),
      em,
    );
  });

  it('resends and uses stored actionDescription from metadata', async () => {
    otpService.resendChallenge.mockResolvedValue({
      plainOtp: '654321',
      response: {
        challengeId: 'challenge-uuid',
        expiresAt: new Date().toISOString(),
        resendAvailableAt: new Date().toISOString(),
        remainingResends: 2,
      },
      challenge: {
        id: 'challenge-uuid',
        user_id: RECIPIENT_ID,
        metadata: {
          publicSessionId: 'session-uuid',
          email: 'john@example.com',
          authContext: OtpAuthContext.PUBLIC_SESSION,
          actionDescription: 'sign a document',
        },
      },
    });

    emailService.sendOtpEmail.mockResolvedValue(undefined);

    const publicSession: PublicSessionContext = {
      sessionId: 'session-uuid',
      recipientId: RECIPIENT_ID,
      documentId: SESSION_DOCUMENT_ID,
      recipientEmail: 'john@example.com',
      expiresAt: new Date(),
    };

    await controller.resendChallenge('challenge-uuid', publicSession);

    expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
      'john@example.com',
      expect.objectContaining({
        actionDescription: 'sign a document',
      }),
    );
  });
});
