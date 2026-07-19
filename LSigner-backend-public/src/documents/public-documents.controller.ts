import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiGoneErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
} from '../common/dto/api-error.dto';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PublicSessionGuard } from '../public-access/guards/public-session.guard';
import { CurrentPublicSession } from '../public-access/decorators/current-public-session.decorator';
import type { PublicSessionContext } from '../public-access/public-session.types';
import { PublicDocumentsService } from './public-documents.service';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import { SignSharedDocumentDto } from '../document-signing/dto/sign-shared-document.dto';
import { RejectSharedDocumentDto } from '../document-signing/dto/reject-shared-document.dto';
import { RevokeSharedDocumentDto } from '../document-signing/dto/revoke-shared-document.dto';
import { SignedDocumentResultDto } from '../document-signing/dto/signed-document-result.dto';
import { ResolveLockDto } from '../locks/dto/resolve-lock.dto';
import { LockStatusDto } from '../locks/dto/lock-status.dto';

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiGoneErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
)
@ApiTags('public-documents')
@Public()
@UseGuards(PublicSessionGuard)
@Controller('v1/public/documents')
export class PublicDocumentsController {
  constructor(
    private readonly publicDocumentsService: PublicDocumentsService,
    private readonly documentSigningService: DocumentSigningService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get my shared document',
    description:
      'Returns the document tied to the caller\'s public session (recipient), and records access. ' +
      'Requires a valid public session cookie, set by the OTP/link exchange flow.',
  })
  @ApiOkResponse({ description: 'Document metadata for the session recipient' })
  @ApiForbiddenResponse({
    description: 'Missing, invalid or expired public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'Public session required' },
            path: { example: '/v1/public/documents/me' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient or document not found, voided, or no longer available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'This document is no longer available' },
            path: { example: '/v1/public/documents/me' },
          },
        },
      ],
    },
  })
  findMine(
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Req() request: Request,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.publicDocumentsService.findMine(
        publicSession.recipientId,
        {
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
        transactionalEntityManager,
      ),
    );
  }

  @Post('me/sign')
  @ApiOperation({
    summary: 'Sign my shared document',
    description:
      'Signs the document tied to the caller\'s public session and stores an Ed25519 signature artifact. ' +
      'Fails if locks are unresolved, the document owner deleted their account, or the recipient status ' +
      'does not allow signing.',
  })
  @ApiCreatedResponse({
    type: SignedDocumentResultDto,
    description: 'Signature recorded',
  })
  @ApiBadRequestResponse({
    description: 'Validation error : malformed verification fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: [
                'verification_reference must be shorter than 120 characters',
              ],
            },
            path: { example: '/v1/public/documents/me/sign' },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      'Missing/invalid/expired public session, or unresolved document locks',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'You must resolve all document locks before signing',
            },
            path: { example: '/v1/public/documents/me/sign' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient or document not found, voided, or no longer available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'Document not found' },
            path: { example: '/v1/public/documents/me/sign' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Recipient status does not allow signing',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: { example: 'This document has already been signed' },
            path: { example: '/v1/public/documents/me/sign' },
          },
        },
      ],
    },
  })
  @ApiGoneResponse({
    description: 'The document owner has deleted their account',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiGoneErrorDto) },
        {
          properties: {
            message: { example: 'The owner has removed his account' },
            path: { example: '/v1/public/documents/me/sign' },
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
        { properties: { path: { example: '/v1/public/documents/me/sign' } } },
      ],
    },
  })
  sign(
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Body() dto: SignSharedDocumentDto,
    @Req() request: Request,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentSigningService.signByRecipientId(
        publicSession.recipientId,
        dto,
        {
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
        transactionalEntityManager,
      ),
    );
  }

  @Post('me/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reject my shared document',
    description:
      'Rejects the document tied to the caller\'s public session. ' +
      'Fails if the recipient has already signed, rejected, or had access revoked.',
  })
  @ApiNoContentResponse({ description: 'Rejection recorded' })
  @ApiBadRequestResponse({
    description: 'Validation error : malformed reason or verification fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: ['reason must be shorter than 1000 characters'],
            },
            path: { example: '/v1/public/documents/me/reject' },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Missing, invalid or expired public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'Public session required' },
            path: { example: '/v1/public/documents/me/reject' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient or document not found, voided, or no longer available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'This document is no longer available' },
            path: { example: '/v1/public/documents/me/reject' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Recipient status does not allow rejection',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: { example: 'This document was already rejected' },
            path: { example: '/v1/public/documents/me/reject' },
          },
        },
      ],
    },
  })
  reject(
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Body() dto: RejectSharedDocumentDto,
    @Req() request: Request,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentSigningService.rejectByRecipientId(
        publicSession.recipientId,
        dto,
        {
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
        transactionalEntityManager,
      ),
    );
  }

  @Post('me/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke my previous signing action',
    description:
      'Revokes the caller\'s previous sign/reject action for the document tied to the public session. ' +
      'Idempotent : revoking an already-revoked recipient is a no-op.',
  })
  @ApiNoContentResponse({ description: 'Revocation recorded' })
  @ApiBadRequestResponse({
    description: 'Validation error : malformed reason or verification fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: ['reason must be shorter than 1000 characters'],
            },
            path: { example: '/v1/public/documents/me/revoke' },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Missing, invalid or expired public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'Public session required' },
            path: { example: '/v1/public/documents/me/revoke' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient or document not found, voided, or no longer available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'This document is no longer available' },
            path: { example: '/v1/public/documents/me/revoke' },
          },
        },
      ],
    },
  })
  revoke(
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Body() dto: RevokeSharedDocumentDto,
    @Req() request: Request,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentSigningService.revokeByRecipientId(
        publicSession.recipientId,
        dto,
        {
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
        transactionalEntityManager,
      ),
    );
  }

  @Get('me/download')
  @ApiOperation({
    summary: 'Download my shared document file',
    description:
      'Streams the binary payload of the document tied to the caller\'s public session. ' +
      'Fails if there are unresolved locks on the document.',
  })
  @ApiOkResponse({ description: 'Binary file stream' })
  @ApiForbiddenResponse({
    description:
      'Missing/invalid/expired public session, or unresolved document locks',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'You must resolve all document locks before downloading',
            },
            path: { example: '/v1/public/documents/me/download' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient or document not found, voided, or no longer available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'Document not found' },
            path: { example: '/v1/public/documents/me/download' },
          },
        },
      ],
    },
  })
  async download(
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Res() response: Response,
  ) {
    const doc = await this.entityManager.transaction(
      (transactionalEntityManager) =>
        this.publicDocumentsService.downloadByRecipientId(
          publicSession.recipientId,
          transactionalEntityManager,
        ),
    );

    response.set({
      'Content-Type': doc.mime_type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.original_filename)}"`,
    });
    response.send(doc.file);
  }

  @Get('me/locks')
  @ApiOperation({
    summary: 'List lock status for my shared document',
    description:
      'Returns lock status scoped to the caller\'s public session recipient, used to resolve ' +
      'protections before downloading or signing.',
  })
  @ApiOkResponse({
    type: [LockStatusDto],
    description: 'Locks with resolution status for the session recipient',
  })
  @ApiForbiddenResponse({
    description: 'Missing, invalid or expired public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'Public session required' },
            path: { example: '/v1/public/documents/me/locks' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient or document not found, voided, or no longer available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: { example: 'This document is no longer available' },
            path: { example: '/v1/public/documents/me/locks' },
          },
        },
      ],
    },
  })
  getLocks(@CurrentPublicSession() publicSession: PublicSessionContext) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.publicDocumentsService.getLocksByRecipientId(
        publicSession.recipientId,
        transactionalEntityManager,
      ),
    );
  }

  @Post('me/locks/:lockId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Resolve a document lock as the session recipient',
    description:
      'Verifies the provided lock credentials (e.g. a password) and records the resolution ' +
      'for the caller\'s public session recipient.',
  })
  @ApiParam({ name: 'lockId', description: 'Lock UUID' })
  @ApiNoContentResponse({ description: 'Lock resolved successfully' })
  @ApiBadRequestResponse({
    description: 'Invalid lock UUID or invalid lock payload',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'password must be a string' },
            path: {
              example:
                '/v1/public/documents/me/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Incorrect lock password',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'Incorrect lock password' },
            path: {
              example:
                '/v1/public/documents/me/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Missing, invalid or expired public session',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'Public session required' },
            path: {
              example:
                '/v1/public/documents/me/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Recipient, document, or lock not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Lock a3bb189e-8bf9-3888-9912-ace4e6543002 not found on document a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
            path: {
              example:
                '/v1/public/documents/me/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Lock already resolved by this recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: { example: 'This lock has already been resolved' },
            path: {
              example:
                '/v1/public/documents/me/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  resolveLock(
    @CurrentPublicSession() publicSession: PublicSessionContext,
    @Param('lockId', ParseUUIDPipe) lockId: string,
    @Body() dto: ResolveLockDto,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.publicDocumentsService.resolveLockByRecipientId(
        publicSession.recipientId,
        lockId,
        dto,
        transactionalEntityManager,
      ),
    );
  }
}
