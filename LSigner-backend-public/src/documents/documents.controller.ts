/// <reference types="multer" />
// This reference forces TypeScript to include the Multer types, which are needed for the FileInterceptor and UploadedFile decorator.
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StripFileFromBodyInterceptor } from '../common/interceptors/strip-file-from-body.interceptor';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
} from '../common/dto/api-error.dto';
import * as crypto from 'crypto';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { DocumentsService } from './documents.service';
import { Document } from '../entities/document.entity';
import { User } from '../entities/user.entity';
import { LocksService } from '../locks/locks.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SendDocumentDto } from './dto/send-document.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import {
  toSentListItem,
  toReceivedListItem,
  toTimelineEvent,
} from './documents.mapper';
import { LockOverviewDto } from '../locks/dto/lock-overview.dto';
import { LockStatusDto } from '../locks/dto/lock-status.dto';
import { ResolveLockDto } from '../locks/dto/resolve-lock.dto';
import {
  SentDocumentDetailDto,
  SentRecipientsListResponseDto,
  SentDocumentViewUrlDto,
} from './dto/sent-documents.dto';
import {
  ReceivedDocumentDetailDto,
  ReceivedDocumentViewUrlDto,
  RejectReceivedDocumentDto,
  RejectReceivedDocumentResponseDto,
} from './dto/received-documents.dto';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import { DocumentSignedArtifact } from '../entities/document-signed-artifact.entity';
import { TimelineResponseDto } from './dto/timeline.dto';

const FILE_SIZE_LIMIT = 150 * 1024 * 1024; // 150 MB

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiForbiddenErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
  TimelineResponseDto,
)
@ApiTags('documents')
@ApiBearerAuth('access-token')
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly locksService: LocksService,
    private readonly documentSigningService: DocumentSigningService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private getBaseUrl(): string {
    return this.configService.get<string[]>('app.corsOrigins')?.[0] ?? '';
  }

  // ===========================================
  // Queries
  // ===========================================

  @Get()
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    summary: 'List my documents',
    description:
      'Returns all documents owned by or sent to the authenticated user. ' +
      'The binary payload is never included : use GET /documents/:id/download for that.',
  })
  @ApiOkResponse({ description: 'List of documents' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/documents' },
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
        { properties: { path: { example: '/documents' } } },
      ],
    },
  })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const docs = await this.documentsService.findAllForUser(
          user.sub,
          transactionalEntityManager,
        );
        return { items: docs };
      },
    );
  }

  @Get('timeline')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    summary: 'Get document timeline events',
    description:
      'Returns a chronological list of document signing events (ACCESS_OPENED, SIGNED, REJECTED, REVOKED) ' +
      'for the authenticated user. Includes both sent (owner) and received (recipient) events. ' +
      'Sorted by occurred_at DESC, max 200 events.',
  })
  @ApiOkResponse({
    type: TimelineResponseDto,
    description: 'Chronological list of signing events',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/documents/timeline' },
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
        { properties: { path: { example: '/documents/timeline' } } },
      ],
    },
  })
  async getTimeline(
    @CurrentUser() user: JwtPayload,
  ): Promise<TimelineResponseDto> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const rows = await this.documentsService.findTimelineForUser(
          user.sub,
          transactionalEntityManager,
        );
        return { items: rows.map(toTimelineEvent) };
      },
    );
  }

  @Get('sent')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    summary: 'List sent documents',
    description:
      'Returns documents owned by the authenticated user (sent by them).',
  })
  @ApiOkResponse({ description: 'List of sent documents' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/documents/sent' },
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
        { properties: { path: { example: '/documents/sent' } } },
      ],
    },
  })
  findSent(@CurrentUser() user: JwtPayload) {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const docs = await this.documentsService.findSentForUser(
          user.sub,
          transactionalEntityManager,
        );
        return { items: docs.map((doc) => toSentListItem(doc)) };
      },
    );
  }

  @Get('sent/recipients')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    summary: 'List sent document recipients',
    description:
      'Returns one row per DocumentRecipient for documents owned by the authenticated user. ' +
      'Each row includes recipient info, signing status, timestamps, and associated document metadata.',
  })
  @ApiOkResponse({
    type: SentRecipientsListResponseDto,
    description: 'Flat list of sent document recipients',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/documents/sent/recipients' },
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
        { properties: { path: { example: '/documents/sent/recipients' } } },
      ],
    },
  })
  findSentRecipients(@CurrentUser() user: JwtPayload) {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        return this.documentsService.findSentRecipientsForUser(
          user.sub,
          transactionalEntityManager,
        );
      },
    );
  }

  @Get('sent/:id/view-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get sent document view URL',
    description:
      'Returns a URL to open the sent document view for the document owner.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: SentDocumentViewUrlDto,
    description: 'View URL payload',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example:
                '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
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
                '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found or not available',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example:
                '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
            path: {
              example:
                '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
          },
        },
      ],
    },
  })
  async getSentViewUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const path = await this.entityManager.transaction(
      (transactionalEntityManager) =>
        this.documentsService.getSentDocumentViewUrl(
          id,
          user.sub,
          transactionalEntityManager,
        ),
    );

    const baseUrl = this.getBaseUrl(); // Returns dev.app.lsigner.com or pro.app.lsigner.com or ... or localhost:3001

    return { url: `${baseUrl}${path}` };
  }

  @Get('received')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    summary: 'List received documents',
    description:
      'Returns documents where the authenticated user is a recipient.',
  })
  @ApiOkResponse({ description: 'List of received documents' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/documents/received' },
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
        { properties: { path: { example: '/documents/received' } } },
      ],
    },
  })
  findReceived(@CurrentUser() user: JwtPayload) {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const docs = await this.documentsService.findReceivedForUser(
          user.sub,
          transactionalEntityManager,
        );
        // findReceivedForUser returns Document[] with recipients and owner loaded.
        // We need to pair each document with the recipient that matches the current user.
        const items = docs.map((doc) => {
          const recipient = doc.recipients.find((recipient) => recipient.user_id === user.sub)!;
          return toReceivedListItem(doc, recipient);
        });
        return { items };
      },
    );
  }

  @Get('sent/:id')
  @ApiOperation({
    summary: 'Get sent document detail',
    description:
      'Returns a richer payload for a sent document owned by the authenticated user. ' +
      'Used by /documents/sent detail screens.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: SentDocumentDetailDto,
    description: 'Sent document detailed payload',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example: '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
              example: '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found or not in sent status',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Document belongs to another owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
            path: {
              example: '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
        {
          properties: {
            path: {
              example: '/documents/sent/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  findSentById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentsService.findSentDocumentByIdForUser(
        id,
        user.sub,
        transactionalEntityManager,
      ),
    );
  }

  @Get('received/:id')
  @ApiOperation({
    summary: 'Get received document detail',
    description:
      'Returns a richer payload for a received document where the authenticated user is a recipient. ' +
      'Used by /documents/received detail screens.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: ReceivedDocumentDetailDto,
    description: 'Received document detailed payload',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found or not a recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  findReceivedById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentsService.findReceivedDocumentByIdForUser(
        id,
        user.sub,
        transactionalEntityManager,
      ),
    );
  }

  @Get('received/:id/view-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get received document view URL',
    description:
      'Returns a URL to open the received document view. ' +
      'Registered recipients receive a private app route; external recipients receive a public route.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: ReceivedDocumentViewUrlDto,
    description: 'View URL payload',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
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
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found or not a recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/view-url',
            },
          },
        },
      ],
    },
  })
  async getReceivedViewUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const publicLinkId = await this.entityManager.transaction(
      (transactionalEntityManager) =>
        this.documentsService.getReceivedRecipientPublicLinkId(
          id,
          user.sub,
          transactionalEntityManager,
        ),
    );

    const baseUrl = this.getBaseUrl();

    return {
      url: publicLinkId
        ? `${baseUrl}/public/${publicLinkId}`
        : `${baseUrl}/documents/received/${id}`,
    };
  }

  @Get('received/:id/locks')
  @ApiOperation({
    summary: 'List lock status for a received document',
    description:
      'Returns lock status scoped to the authenticated user for a received document. ' +
      'Used by recipient flows to resolve protections before downloading/signing.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: [LockStatusDto],
    description: 'Locks with resolution status for the authenticated user',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
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
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
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
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is neither owner nor recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'You do not have access to this document',
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
          },
        },
      ],
    },
  })
  getReceivedDocumentLocks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.locksService.getLocksForDocument(
        id,
        user.sub,
        transactionalEntityManager,
      ),
    );
  }

  @Post('received/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a received document',
    description:
      'Rejects the document signature for the authenticated recipient. ' +
      'Only allowed when the signing status is PENDING.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: RejectReceivedDocumentResponseDto,
    description: 'Rejection recorded',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID or body validation error',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: ['reason must be shorter than 1000 characters'],
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/reject',
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
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/reject',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document not found or not a recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/reject',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description:
      'Invalid state transition : already signed, rejected, or revoked',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example:
                'This document was already signed and cannot be rejected',
            },
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/reject',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/received/a3bb189e-8bf9-3888-9912-ace4e6543002/reject',
            },
          },
        },
      ],
    },
  })
  rejectReceivedDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReceivedDocumentDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentSigningService.rejectByRecipientUserId(
        id,
        user.sub,
        dto,
        {
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
        transactionalEntityManager,
      ),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get document metadata',
    description:
      'Returns metadata and recipient list for a single document. ' +
      'Accessible by the owner or any recipient.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Document metadata' })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not owner or recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'You do not have access to this document',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
        {
          properties: {
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const doc = await this.documentsService.findById(
          id,
          user.sub,
          transactionalEntityManager,
        );
        // Record access for recipients (not the owner)
        const isOwner = doc.owner_id === user.sub;
        if (!isOwner) {
          const recipient = doc.recipients.find((recipient) => recipient.user_id === user.sub);
          if (recipient) {
            await this.documentsService.recordAccess(
              recipient.id,
              transactionalEntityManager,
            );
          }
        }
        return doc;
      },
    );
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download document file',
    description:
      'Streams the binary payload of the document. ' +
      'Accessible by the owner or any recipient.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Binary file stream' })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/download',
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
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/download',
            },
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
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/download',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not owner or recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not have access to this document' },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/download',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/download',
            },
          },
        },
      ],
    },
  })
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() response: Response,
  ) {
    const doc = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // First, load document metadata to identify the recipient and record access
        const docAccess = await this.documentsService.findById(
          id,
          user.sub,
          transactionalEntityManager,
        );
        const isOwner = docAccess.owner_id === user.sub;
        if (!isOwner) {
          const recipient = docAccess.recipients.find(
            (recipient) => recipient.user_id === user.sub,
          );
          if (recipient) {
            await this.documentsService.recordAccess(
              recipient.id,
              transactionalEntityManager,
            );
          }
        }

        // Now perform the actual download
        return this.documentsService.download(
          id,
          user.sub,
          transactionalEntityManager,
        );
      },
    );

    response.set({
      'Content-Type': doc.mime_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.original_filename)}"`,
    });
    response.send(doc.file);
  }

  @Get(':id/locks')
  @ApiOperation({
    summary: 'List all locks with resolution status per recipient',
    description:
      'Returns every lock applied to the document together with the resolution ' +
      'status for ALL recipients. Only the document owner can access this endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({
    type: [LockOverviewDto],
    description: 'Locks with per-recipient resolution status',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
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
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
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
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: {
              example: 'Only the document owner can view the locks overview',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
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
        {
          properties: {
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks',
            },
          },
        },
      ],
    },
  })
  getLocksOverview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.locksService.getLocksOverview(
        id,
        user.sub,
        transactionalEntityManager,
      ),
    );
  }

  @Post(':id/locks/:lockId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Resolve document lock as recipient',
    description:
      'Verifies provided lock credentials and records the lock resolution for the authenticated recipient.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiParam({ name: 'lockId', description: 'Lock UUID' })
  @ApiNoContentResponse({ description: 'Lock resolved successfully' })
  @ApiBadRequestResponse({
    description: 'Invalid UUIDs or invalid lock payload',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['password must be a string'] },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
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
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'User is not a recipient of this document',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You are not a recipient of this document' },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Lock not found on this document',
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
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
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
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/locks/a3bb189e-8bf9-3888-9912-ace4e6543002/resolve',
            },
          },
        },
      ],
    },
  })
  resolveLock(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lockId', ParseUUIDPipe) lockId: string,
    @Body() dto: ResolveLockDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.locksService.resolveLock(
        lockId,
        id,
        user.sub,
        dto,
        transactionalEntityManager,
      ),
    );
  }

  // ===========================================
  // Mutations
  // ===========================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_SIZE_LIMIT } }),
  )
  @ApiOperation({
    summary: 'Upload a new document',
    description:
      'Creates a new document in DRAFT status. ' +
      'The file must be sent as multipart/form-data. ' +
      'Allowed types: PDF, DOCX, plain text, Markdown. Max size: 150 MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file',
        },
        title: {
          type: 'string',
          description: 'Document title',
          example: 'Employment Contract 2026',
        },
        description: { type: 'string', description: 'Optional description' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Document created successfully' })
  @ApiBadRequestResponse({
    description: 'Missing file, title not provided, or invalid metadata',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'A file is required to create a document' },
            path: { example: '/documents' },
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
            path: { example: '/documents' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Unsupported file type or file exceeds the 150 MB limit',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example:
                'Unsupported file type "application/zip". Allowed: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/markdown',
            },
            path: { example: '/documents' },
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
        { properties: { path: { example: '/documents' } } },
      ],
    },
  })
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentsService.create(
        dto,
        file,
        user.sub,
        transactionalEntityManager,
      ),
    );
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_SIZE_LIMIT } }),
    StripFileFromBodyInterceptor,
  )
  @ApiOperation({
    summary: 'Update a document',
    description:
      'If the document is in DRAFT status, updates it in-place. ' +
      'If SENT, creates a new version (the old one becomes SUPERSEDED and its recipients are marked as UPDATED). ' +
      'A new file may optionally be provided via multipart/form-data.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Optional replacement file',
        },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Document updated or new version created' })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['title should not be empty'] },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Document is VOIDED or DELETED and cannot be updated',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example:
                'Cannot update a document with status "VOIDED". You must create a new version instead.',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
        {
          properties: {
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentsService.update(
        id,
        dto,
        file,
        user.sub,
        transactionalEntityManager,
      ),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete or void a document',
    description:
      'DRAFT and SUPERSEDED documents are hard-deleted. ' +
      'SENT documents are soft-deleted (status -> DELETED). ' +
      'Only the owner can perform this action.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiNoContentResponse({ description: 'Document deleted or voided' })
  @ApiBadRequestResponse({
    description: 'Invalid document UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
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
        {
          properties: {
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.documentsService.remove(id, user.sub, transactionalEntityManager),
    );
  }

  @Post(':id/recipients/:recipientId/reminder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Send reminder to a document recipient',
    description:
      'Sends a reminder email to a recipient of a sent document. ' +
      'Only allowed when the document is SENT and the recipient status is PENDING.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiParam({ name: 'recipientId', description: 'Document recipient UUID' })
  @ApiNoContentResponse({ description: 'Reminder sent successfully' })
  @ApiBadRequestResponse({
    description: 'Recipient status is not PENDING',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example:
                'Reminders can only be sent to recipients with PENDING status',
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
            message: {
              example: 'Recipient not found for document',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Document is not in SENT status',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document must be in SENT status to send a reminder (current: "DRAFT")',
            },
          },
        },
      ],
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    schema: {
      allOf: [{ $ref: getSchemaPath(ApiInternalServerErrorDto) }],
    },
  })
  sendReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager
      .transaction((transactionalEntityManager) =>
        this.documentsService.sendSentDocumentReminder(
          id,
          recipientId,
          user.sub,
          transactionalEntityManager,
        ),
      )
      .then((context) => {
        const baseUrl = this.getBaseUrl();
        const documentLink = context.recipientPublicLinkId
          ? `${baseUrl}/public/${context.recipientPublicLinkId}`
          : `${baseUrl}/documents/received/${context.documentId}`;

        void this.emailService
          .sendReminder(
            context.recipientEmail,
            context.documentName,
            context.senderName,
            context.recipientName,
            documentLink,
          )
          .catch((err) => {
            this.logger.error('Failed to send reminder email', err);
          });
      });
  }

  @Delete(':id/recipients/:recipientId/shared-access')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete recipient shared access',
    description:
      'Deletes shared-access capability for a recipient in a sent document. ' +
      'This is an owner action and maps to a REVOKED state in signing tracking.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiParam({
    name: 'recipientId',
    description: 'Document recipient UUID',
  })
  @ApiNoContentResponse({ description: 'Recipient shared access deleted' })
  @ApiBadRequestResponse({
    description: 'Validation error on payload or params',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['recipientId must be a UUID'] },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/recipients/a3bb189e-8bf9-3888-9912-ace4e6543002/shared-access',
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
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/recipients/a3bb189e-8bf9-3888-9912-ace4e6543002/shared-access',
            },
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
            message: {
              example:
                'Recipient a3bb189e-8bf9-3888-9912-ace4e6543002 not found for document a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/recipients/a3bb189e-8bf9-3888-9912-ace4e6543002/shared-access',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/recipients/a3bb189e-8bf9-3888-9912-ace4e6543002/shared-access',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Recipient already signed or document is not sent',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'Cannot revoke a recipient that already signed',
            },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/recipients/a3bb189e-8bf9-3888-9912-ace4e6543002/shared-access',
            },
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
        {
          properties: {
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/recipients/a3bb189e-8bf9-3888-9912-ace4e6543002/shared-access',
            },
          },
        },
      ],
    },
  })
  deleteRecipientSharedAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entityManager
      .transaction((transactionalEntityManager) =>
        this.documentSigningService.revokeRecipientByOwner(
          id,
          recipientId,
          user.sub,
          {},
          transactionalEntityManager,
        ),
      )
      .then((context) => {
        if (context) {
          void this.emailService
            .sendUnshared(
              context.recipientEmail,
              context.documentName,
              context.senderName,
              context.recipientName,
            )
            .catch((err) => {
              this.logger.error('Failed to send unshared email', err);
            });
        }
      });
  }

  @Post(':id/send')
  @ApiOperation({
    summary: 'Send document to recipients',
    description:
      'Dispatches the document to one or more recipients and transitions its status from DRAFT to SENT. ' +
      'Recipients can be registered users (provide user_id) or external (email-only). ' +
      'The same document cannot be sent to the same email twice. ' +
      'Optionally include a `locks` array to protect the document : recipients must resolve all locks before downloading.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiOkResponse({ description: 'Document sent successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed recipient fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['recipients should not be empty'] },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
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
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Document or referenced recipient user not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
            },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: 'Not the document owner',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiForbiddenErrorDto) },
        {
          properties: {
            message: { example: 'You do not own this document' },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Document is not in DRAFT status or a recipient appears twice',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example:
                'Document must be in DRAFT status to send (current: "SENT")',
            },
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
            },
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
        {
          properties: {
            path: {
              example: '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/send',
            },
          },
        },
      ],
    },
  })
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const { document, senderName } = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const doc = await this.documentsService.send(
          id,
          dto,
          user.sub,
          transactionalEntityManager,
        );

        const owner = await transactionalEntityManager.findOne(User, {
          where: { patient_id: user.sub },
          select: ['patient_id', 'name', 'last_name'],
        });
        const name = owner ? `${owner.name} ${owner.last_name}` : user.email;

        return { document: doc, senderName: name };
      },
    );

    const baseUrl = this.getBaseUrl();

    // Fire-and-forget emails in parallel : response is sent immediately after
    // the DB transaction. Email failures are logged internally by EmailService.
    void Promise.allSettled(
      document.recipients.map((recipient) => {
        const documentLink = recipient.public_link_id
          ? `${baseUrl}/public/${recipient.public_link_id}`
          : `${baseUrl}/documents/received/${document.id}`;

        return this.emailService.sendDocumentNotification(
          recipient.recipient_email,
          {
            recipientName:
              recipient.recipient_name ?? recipient.recipient_email,
            senderName: senderName,
            documentName: document.title,
            documentLink,
          },
        );
      }),
    );

    return document;
  }

  // ===========================================
  // Verification
  // ===========================================

  @Public()
  @Get(':id/verify/:recipientId')
  @ApiOperation({
    summary: 'Verify Ed25519 document signature',
    description:
      'Returns the Ed25519 signature, public key, canonical payload, and server-side verification status. ' +
      'Copy public_key_hex, canonical_payload, and signature_hex into any Ed25519 verification tool.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiParam({ name: 'recipientId', description: 'Recipient UUID' })
  @ApiQuery({
    name: 'raw',
    required: false,
    description:
      'Return text/plain payload without JSON escaping for copy-paste',
  })
  @ApiOkResponse({
    description:
      'Verification data with signature, public key, canonical payload, and server-side verification result',
  })
  @ApiBadRequestResponse({
    description: 'Invalid document or recipient UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/verify/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'No signed artifact found for this document and recipient',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'No signed artifact found for this document and recipient',
            },
            path: {
              example:
                '/documents/a3bb189e-8bf9-3888-9912-ace4e6543002/verify/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  async verifySignature(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Query('raw') raw?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const artifact = await this.entityManager.findOne(DocumentSignedArtifact, {
      where: { document_id: documentId, recipient_id: recipientId },
    });

    if (!artifact || !artifact.canonical_payload) {
      throw new NotFoundException(
        'No signed artifact found for this document and recipient',
      );
    }

    if (raw !== undefined && res) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return artifact.canonical_payload;
    }

    let signatureHex: string | null = null;
    let serverVerified = false;
    let serverError: string | null = null;

    const signingConfig = this.configService.get<{ publicKeyHex: string }>(
      'signing',
    );
    const publicKeyHex =
      artifact.public_key_hex || signingConfig?.publicKeyHex || '';

    try {
      const rawKey = Buffer.from(publicKeyHex, 'hex');
      const prefix = Buffer.from('302a300506032b6570032100', 'hex');
      const publicKey = crypto.createPublicKey({
        key: Buffer.concat([prefix, rawKey]),
        format: 'der',
        type: 'spki',
      });
      const message = Buffer.from(artifact.canonical_payload, 'utf8');
      const signature = Buffer.from(artifact.signature, 'base64');
      signatureHex = signature.toString('hex');
      serverVerified = crypto.verify(null, message, publicKey, signature);
      if (!serverVerified) {
        serverError =
          'Signature does not verify. The artifact may be corrupted or the key may have changed.';
      }
    } catch (err) {
      serverError = `Verification error: ${(err as Error).message}`;
    }

    return {
      document_id: documentId,
      recipient_id: recipientId,
      artifact: {
        id: artifact.id,
        signature: artifact.signature,
        signature_algorithm: artifact.signature_algorithm,
        key_fingerprint: artifact.key_fingerprint,
        key_version: artifact.key_version,
        previous_artifact_id: artifact.previous_artifact_id,
        signed_at: artifact.signed_at.toISOString(),
      },
      public_key_hex: publicKeyHex,
      signature_hex: signatureHex,
      canonical_payload: artifact.canonical_payload,
      server_verified: serverVerified,
      server_error: serverError,
    };
  }
}
