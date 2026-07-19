import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import type { Request } from 'express';
import { EntityManager } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import {
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
} from '../common/dto/api-error.dto';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import { EmailService } from '../email/email.service';

import { PublicSessionGuard } from '../public-access/guards/public-session.guard';
import { CurrentPublicSession } from '../public-access/decorators/current-public-session.decorator';
import type { PublicSessionContext } from '../public-access/public-session.types';
import { CreateOtpChallengeDto } from './dto/create-otp-challenge.dto';
import { OtpChallengeResponseDto } from './dto/otp-challenge-response.dto';
import { OtpResendResponseDto } from './dto/otp-resend-response.dto';
import { OtpVerifyResponseDto } from './dto/otp-verify-response.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpActionType } from './enums/otp-action-type.enum';
import { OtpAuthContext } from './enums/otp-auth-context.enum';
import { OtpService } from './otp.service';

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
)
@ApiTags('otp-public')
@Public()
@UseGuards(PublicSessionGuard)
@Controller('v1/public/otp')
export class OtpPublicController {
  private readonly logger = new Logger(OtpPublicController.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly documentSigningService: DocumentSigningService,
    private readonly emailService: EmailService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @Post('challenges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an OTP challenge (public session)',
    description:
      'Creates an OTP challenge for an external (non-registered) recipient ' +
      'using an existing public session. The OTP is sent by email. ' +
      'Validates that the resource belongs to the current public session ' +
      'and that the action (sign/reject/revoke) is allowed given the document and signing status.',
  })
  @ApiCreatedResponse({
    type: OtpChallengeResponseDto,
    description: 'OTP challenge created',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: ['actionType must be one of: SIGN, REJECT, REVOKE'],
            },
            path: { example: '/v1/public/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Resource does not belong to the current public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'Document does not belong to this public session',
            },
            path: { example: '/v1/public/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document or recipient not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'Document not found' },
            path: { example: '/v1/public/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description:
      'Invalid state transition — document is already signed, rejected, or revoked',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'This document has already been signed',
            },
            path: { example: '/v1/public/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiInternalServerErrorDto) },
        { properties: { path: { example: '/v1/public/otp/challenges' } } },
      ],
    },
  })
  async createChallenge(
    @Body() dto: CreateOtpChallengeDto,
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Req() request: Request,
  ): Promise<OtpChallengeResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const { signingStatus, documentStatus, email } =
          await this.otpService.resolvePublicChallengeContext(
            dto.resourceId,
            publicSession.recipientId,
            publicSession.documentId,
            transactionalEntityManager,
          );

        this.documentSigningService.validateDocumentAction(
          dto.actionType,
          documentStatus,
          signingStatus,
        );

        const { challenge, plainOtp, response } =
          await this.otpService.createChallenge(
            publicSession.recipientId,
            dto,
            {
              authContext: OtpAuthContext.PUBLIC_SESSION,
              publicSessionId: publicSession.sessionId,
              ip: request.ip ?? null,
              userAgent: request.get('user-agent') ?? null,
              reason: dto.reason ?? null,
              email,
              actionDescription:
                actionDescriptionMap[dto.actionType] ??
                dto.actionType.toLowerCase(),
            },
            transactionalEntityManager,
          );

        void this.emailService
          .sendOtpEmail(email, {
            code: plainOtp,
            expiresInMinutes: Math.ceil(this.otpService.getTtlSeconds() / 60),
            actionDescription:
              actionDescriptionMap[dto.actionType] ??
              dto.actionType.toLowerCase(),
          })
          .catch((err: Error) => {
            this.logger.error(
              `Failed to send OTP email for public challenge ${challenge.id}: ${err.message}`,
            );
          });

        return response;
      },
    );
  }

  @Post('challenges/:challengeId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend an OTP code (public session)',
    description:
      'Generates a new OTP code for an existing public challenge and emails it again. ' +
      'Resets the attempt counter. Validates that the challenge belongs to the current ' +
      'public session.',
  })
  @ApiParam({ name: 'challengeId', description: 'OTP challenge UUID' })
  @ApiOkResponse({
    type: OtpResendResponseDto,
    description: 'OTP resent successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — missing or malformed challengeId',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['challengeId must be a UUID'] },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Challenge does not belong to this public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'Challenge does not belong to this public session',
            },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Challenge not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'Challenge not found' },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Challenge is locked, cancelled, or resend limit reached',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'Challenge is locked. Try again in 842 seconds',
            },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  @ApiGoneResponse({
    description: 'OTP has expired',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiInternalServerErrorDto) },
        {
          properties: {
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  async resendChallenge(
    @Param('challengeId') challengeId: string,
    @CurrentPublicSession() publicSession: PublicSessionContext,
  ): Promise<OtpResendResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const { plainOtp, response, challenge } =
          await this.otpService.resendChallenge(
            challengeId,
            publicSession.recipientId,
            transactionalEntityManager,
            OtpAuthContext.PUBLIC_SESSION,
          );

        const metadata = challenge.metadata;
        if (
          (metadata.publicSessionId as string | undefined) !==
          publicSession.sessionId
        ) {
          throw new ForbiddenException(
            'Challenge does not belong to this public session',
          );
        }

        const email =
          (challenge.metadata.email as string) ?? publicSession.recipientEmail;
        if (email) {
          void this.emailService
            .sendOtpEmail(email, {
              code: plainOtp,
              expiresInMinutes: Math.ceil(this.otpService.getTtlSeconds() / 60),
              actionDescription:
                (challenge.metadata.actionDescription as string) ?? '',
            })
            .catch((err: Error) => {
              this.logger.error(
                `Failed to resend OTP email for public challenge ${challengeId}: ${err.message}`,
              );
            });
        }

        return response;
      },
    );
  }

  @Post('challenges/:challengeId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and execute action (public session)',
    description:
      'Validates the OTP code for a public session challenge and, on success, ' +
      'executes the authorised action (sign/reject/revoke). Validates that the challenge ' +
      'belongs to the current public session. The action runs inside the same transaction.',
  })
  @ApiParam({ name: 'challengeId', description: 'OTP challenge UUID' })
  @ApiOkResponse({
    type: OtpVerifyResponseDto,
    description: 'OTP verified and action executed',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['code must be a string'] },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Challenge does not belong to this public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'Challenge does not belong to this public session',
            },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Challenge not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'Challenge not found' },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description:
      'Challenge is already consumed, cancelled, or action has invalid state transition',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'OTP has already been used',
            },
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  @ApiGoneResponse({
    description: 'OTP has expired',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid OTP code or maximum attempts exceeded',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiInternalServerErrorDto) },
        {
          properties: {
            path: {
              example:
                '/v1/public/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  async verifyChallenge(
    @Param('challengeId') challengeId: string,
    @Body() dto: VerifyOtpDto,
    @CurrentPublicSession() publicSession: PublicSessionContext,
  ): Promise<OtpVerifyResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const verifiedChallenge = await this.otpService.verifyChallenge(
          challengeId,
          dto.code,
          publicSession.recipientId,
          transactionalEntityManager,
          OtpAuthContext.PUBLIC_SESSION,
        );

        const metadata = verifiedChallenge.metadata;
        if (
          (metadata.publicSessionId as string | undefined) !==
          publicSession.sessionId
        ) {
          throw new ForbiddenException(
            'Challenge does not belong to this public session',
          );
        }

        const context = {
          ip: (metadata.ip as string) ?? null,
          userAgent: (metadata.userAgent as string) ?? null,
        };

        const actionResult =
          await this.documentSigningService.executeOtpActionByRecipientId(
            verifiedChallenge.action_type,
            publicSession.recipientId,
            verifiedChallenge.resource_id,
            challengeId,
            context,
            (metadata.reason as string) ?? undefined,
            transactionalEntityManager,
          );

        return {
          verified: true,
          actionResult,
        };
      },
    );
  }
}

const actionDescriptionMap: Partial<Record<OtpActionType, string>> = {
  [OtpActionType.SIGN]: 'sign a document',
  [OtpActionType.REJECT]: 'reject a document',
  [OtpActionType.REVOKE]: 'revoke a signature',
};
