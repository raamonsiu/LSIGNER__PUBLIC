import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { OtpActionType } from './enums/otp-action-type.enum';
import { OtpAuthContext } from './enums/otp-auth-context.enum';
import { OtpResourceType } from './enums/otp-resource-type.enum';
import { OtpChallenge } from '../entities/otp-challenge.entity';
import { EmailService } from '../email/email.service';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import { DocumentStatus } from '../entities/document.entity';
import type { Request } from 'express';

const USER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const RESOURCE_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';
const CHALLENGE_ID = 'challenge-uuid';

describe('OtpController', () => {
  let controller: OtpController;
  let em: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    transaction: jest.Mock;
  };
  let otpService: {
    createChallenge: jest.Mock;
    verifyChallenge: jest.Mock;
    resendChallenge: jest.Mock;
    resolveJwtChallengeContext: jest.Mock;
    getTtlSeconds: jest.Mock;
  };
  let documentSigningService: {
    validateDocumentAction: jest.Mock;
    executeOtpActionByUserId: jest.Mock;
  };
  let emailService: {
    sendOtpEmail: jest.Mock;
  };

  beforeEach(async () => {
    em = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      transaction: jest.fn((cb: (em: unknown) => unknown) =>
        cb(em),
      ) as jest.Mock,
    };

    otpService = {
      createChallenge: jest.fn(),
      verifyChallenge: jest.fn(),
      resendChallenge: jest.fn(),
      resolveJwtChallengeContext: jest.fn(),
      getTtlSeconds: jest.fn().mockReturnValue(300),
    };

    documentSigningService = {
      validateDocumentAction: jest.fn(),
      executeOtpActionByUserId: jest.fn(),
    };

    emailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OtpController],
      providers: [
        { provide: OtpService, useValue: otpService },
        { provide: DocumentSigningService, useValue: documentSigningService },
        { provide: EmailService, useValue: emailService },
        { provide: getEntityManagerToken(), useValue: em },
      ],
    }).compile();

    controller = module.get(OtpController);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates challenge with JWT context', async () => {
    otpService.resolveJwtChallengeContext.mockResolvedValue({
      document: {
        id: RESOURCE_ID,
        owner_id: USER_ID,
        status: DocumentStatus.SENT,
      },
      recipient: { id: 'recipient-uuid' },
      signingStatus: 'PENDING',
      email: 'john@example.com',
    });
    otpService.createChallenge.mockResolvedValue({
      challenge: { id: CHALLENGE_ID },
      plainOtp: '123456',
      response: {
        challengeId: CHALLENGE_ID,
        expiresAt: new Date().toISOString(),
        resendAvailableAt: new Date().toISOString(),
        maskedDestination: 'j***@example.com',
        remainingAttempts: 5,
        remainingResends: 3,
      },
    });

    const result = await controller.createChallenge(
      {
        actionType: OtpActionType.SIGN,
        resourceType: OtpResourceType.DOCUMENT,
        resourceId: RESOURCE_ID,
      },
      { sub: USER_ID, email: 'john@example.com' },
      { ip: '127.0.0.1', get: jest.fn() } as unknown as Request,
    );

    expect(result.challengeId).toBe(CHALLENGE_ID);
    expect(otpService.resolveJwtChallengeContext).toHaveBeenCalledWith(
      RESOURCE_ID,
      USER_ID,
      em,
    );
    expect(documentSigningService.validateDocumentAction).toHaveBeenCalledWith(
      OtpActionType.SIGN,
      DocumentStatus.SENT,
      'PENDING',
    );
    expect(otpService.createChallenge).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Object),
      expect.objectContaining({
        authContext: OtpAuthContext.JWT,
        actionDescription: 'sign a document',
      }),
      em,
    );
  });

  it('uses stored actionDescription on resend email instead of empty string', async () => {
    otpService.resendChallenge.mockResolvedValue({
      plainOtp: '654321',
      response: {
        challengeId: CHALLENGE_ID,
        expiresAt: new Date().toISOString(),
        resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
        remainingResends: 2,
      },
      challenge: {
        id: CHALLENGE_ID,
        user_id: USER_ID,
        metadata: {
          actionDescription: 'sign a document',
          email: 'john@example.com',
        },
      },
    });

    emailService.sendOtpEmail.mockResolvedValue(undefined);

    await controller.resendChallenge(CHALLENGE_ID, {
      sub: USER_ID,
      email: 'john@example.com',
    });

    expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
      'john@example.com',
      expect.objectContaining({
        actionDescription: 'sign a document',
      }),
    );
  });

  it('rejects resend from public challenge context', async () => {
    otpService.resendChallenge.mockRejectedValue(
      new ForbiddenException(
        'Challenge must be resent from public OTP endpoint',
      ),
    );

    await expect(
      controller.resendChallenge(CHALLENGE_ID, {
        sub: USER_ID,
        email: 'john@example.com',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(otpService.resendChallenge).toHaveBeenCalledWith(
      CHALLENGE_ID,
      USER_ID,
      em,
      OtpAuthContext.JWT,
    );
  });

  it('verifies OTP and executes SIGN action in JWT context', async () => {
    const challenge = {
      id: CHALLENGE_ID,
      user_id: USER_ID,
      action_type: OtpActionType.SIGN,
      resource_id: RESOURCE_ID,
      metadata: {
        authContext: OtpAuthContext.JWT,
        ip: null,
        userAgent: null,
        reason: undefined,
      },
      otp_hash: 'hash',
      otp_salt: 'salt',
    } as unknown as OtpChallenge;

    otpService.verifyChallenge.mockResolvedValue(challenge);
    documentSigningService.executeOtpActionByUserId.mockResolvedValue({
      resourceType: 'DOCUMENT',
      resourceId: RESOURCE_ID,
      newStatus: 'SIGNED',
      metadata: { artifactId: 'artifact-uuid', recipientId: 'recipient-uuid' },
    });

    const result = await controller.verifyChallenge(
      CHALLENGE_ID,
      { code: '123456' },
      { sub: USER_ID, email: 'john@example.com' },
    );

    expect(result.verified).toBe(true);
    expect(result.actionResult.newStatus).toBe('SIGNED');
    expect(otpService.verifyChallenge).toHaveBeenCalledWith(
      CHALLENGE_ID,
      '123456',
      USER_ID,
      em,
      OtpAuthContext.JWT,
    );
    expect(documentSigningService.executeOtpActionByUserId).toHaveBeenCalled();
  });
});
