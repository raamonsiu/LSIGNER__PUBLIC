import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
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
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import type { Request } from 'express';
import { EntityManager } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import {
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
} from '../common/dto/api-error.dto';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import { EmailService } from '../email/email.service';
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
  ApiUnauthorizedErrorDto,
)
@ApiTags('otp')
@Controller('v1/otp')
export class OtpController {
  private readonly logger = new Logger(OtpController.name);

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
    summary: 'Create an OTP challenge',
    description:
      'Validates document access and signing state, then creates an OTP challenge ' +
      'for the requested action (sign/reject/revoke). The OTP is sent by email. ' +
      'Only one active challenge per (user, action, resource) scope is allowed.',
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
            path: { example: '/v1/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/v1/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'Document not found' },
            path: { example: '/v1/otp/challenges' },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to the document',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'You do not have access to this document',
            },
            path: { example: '/v1/otp/challenges' },
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
            path: { example: '/v1/otp/challenges' },
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
        { properties: { path: { example: '/v1/otp/challenges' } } },
      ],
    },
  })
  async createChallenge(
    @Body() dto: CreateOtpChallengeDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<OtpChallengeResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const { document, signingStatus, email } =
          await this.otpService.resolveJwtChallengeContext(
            dto.resourceId,
            user.sub,
            transactionalEntityManager,
          );

        this.documentSigningService.validateDocumentAction(
          dto.actionType,
          document.status,
          signingStatus,
        );

        const { challenge, plainOtp, response } =
          await this.otpService.createChallenge(
            user.sub,
            dto,
            {
              authContext: OtpAuthContext.JWT,
              ip: request.ip ?? null,
              userAgent: request.get('user-agent') ?? null,
              reason: dto.reason ?? null,
              email: email || user.email,
              actionDescription:
                actionDescriptionMap[dto.actionType] ??
                dto.actionType.toLowerCase(),
            },
            transactionalEntityManager,
          );

        void this.emailService
          .sendOtpEmail(email || user.email, {
            code: plainOtp,
            expiresInMinutes: Math.ceil(this.otpService.getTtlSeconds() / 60),
            actionDescription:
              actionDescriptionMap[dto.actionType] ??
              dto.actionType.toLowerCase(),
          })
          .catch((err: Error) => {
            this.logger.error(
              `Failed to send OTP email for challenge ${challenge.id}: ${err.message}`,
            );
          });

        return response;
      },
    );
  }

  @Post('challenges/:challengeId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend an OTP code',
    description:
      'Generates a new OTP code for an existing challenge and emails it again. ' +
      'Resets the attempt counter. Only allowed when the challenge is ACTIVE, ' +
      'not expired, not locked, and within the resend limit.',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: {
              example:
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      'Challenge does not belong to this user or was created from a different auth context',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'Challenge must be resent from public OTP endpoint',
            },
            path: {
              example:
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/resend',
            },
          },
        },
      ],
    },
  })
  async resendChallenge(
    @Param('challengeId') challengeId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OtpResendResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const { plainOtp, response, challenge } =
          await this.otpService.resendChallenge(
            challengeId,
            user.sub,
            transactionalEntityManager,
            OtpAuthContext.JWT,
          );

        const email = (challenge.metadata.email as string) ?? user.email;
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
                `Failed to resend OTP email for challenge ${challengeId}: ${err.message}`,
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
    summary: 'Verify OTP and execute the authorised action',
    description:
      'Validates the OTP code and, on success, executes the action (sign/reject/revoke) ' +
      'that was specified when the challenge was created. The action runs inside the same ' +
      'database transaction as the verification — if the action fails, the OTP is not consumed.',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: {
              example:
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Challenge belongs to a different user or auth context',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'Challenge must be verified from public OTP endpoint',
            },
            path: {
              example:
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
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
                '/v1/otp/challenges/a3bb189e-8bf9-3888-9912-ace4e6543002/verify',
            },
          },
        },
      ],
    },
  })
  async verifyChallenge(
    @Param('challengeId') challengeId: string,
    @Body() dto: VerifyOtpDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OtpVerifyResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const verifiedChallenge = await this.otpService.verifyChallenge(
          challengeId,
          dto.code,
          user.sub,
          transactionalEntityManager,
          OtpAuthContext.JWT,
        );

        const context = {
          ip: (verifiedChallenge.metadata.ip as string) ?? null,
          userAgent: (verifiedChallenge.metadata.userAgent as string) ?? null,
        };

        const actionResult =
          await this.documentSigningService.executeOtpActionByUserId(
            verifiedChallenge.action_type,
            verifiedChallenge.resource_id,
            user.sub,
            challengeId,
            context,
            (verifiedChallenge.metadata.reason as string) ?? undefined,
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
