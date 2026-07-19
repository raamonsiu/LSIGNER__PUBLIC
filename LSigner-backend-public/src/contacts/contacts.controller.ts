import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
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
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
} from '../common/dto/api-error.dto';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
)
@ApiTags('contacts')
@ApiBearerAuth('access-token')
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List my contacts',
    description:
      'Returns all contacts owned by the authenticated user, optionally filtered ' +
      'by a search query that matches email, name, or phone (case-insensitive).',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Optional search query (matches email, name, or phone)',
    example: 'alice',
  })
  @ApiOkResponse({ description: 'List of contacts' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/contacts' },
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
        { properties: { path: { example: '/contacts' } } },
      ],
    },
  })
  findAll(@CurrentUser() user: JwtPayload, @Query('q') query?: string) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.contactsService.findAll(
        user.sub,
        query || undefined,
        transactionalEntityManager,
      ),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a contact',
    description:
      'Saves a new contact for the authenticated user. ' +
      'The contact email must be unique per owner.',
  })
  @ApiCreatedResponse({ description: 'Contact created successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: [
                'contact_email must be an email',
                'contact_phone must be a valid E.164 phone number (e.g. +34600000000)',
              ],
            },
            path: { example: '/contacts' },
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
            path: { example: '/contacts' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Contact with this email already exists for the user',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'Contact with email "alice@example.com" already exists',
            },
            path: { example: '/contacts' },
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
        { properties: { path: { example: '/contacts' } } },
      ],
    },
  })
  create(@Body() dto: CreateContactDto, @CurrentUser() user: JwtPayload) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.contactsService.create(user.sub, dto, transactionalEntityManager),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a contact',
    description: 'Deletes a contact owned by the authenticated user.',
  })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiNoContentResponse({ description: 'Contact deleted successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error : id is not a valid UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: { example: '/contacts/not-a-uuid' },
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
              example: '/contacts/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Contact not found or not owned by the caller',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'Contact a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/contacts/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
            path: { example: '/contacts/a3bb189e-8bf9-3888-9912-ace4e6543002' },
          },
        },
      ],
    },
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.entityManager.transaction((transactionalEntityManager) =>
      this.contactsService.delete(user.sub, id, transactionalEntityManager),
    );
  }
}
