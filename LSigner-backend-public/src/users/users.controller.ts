import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UsersService } from './users.service';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserSearchResultDto } from './dto/user-search-result.dto';

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiConflictErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
  ApiUnauthorizedErrorDto,
)
@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  // ===============================================
  // Own profile
  // ===============================================

  @Get('me')
  @ApiOperation({
    summary: 'Get my profile',
    description:
      'Returns the profile of the currently authenticated user. ' +
      'The patient ID is resolved from the access token : no parameter required.',
  })
  @ApiOkResponse({ description: 'Own user profile' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/users/me' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'User with ID a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: { example: '/users/me' },
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
        { properties: { path: { example: '/users/me' } } },
      ],
    },
  })
  getMe(@CurrentUser() currentUser: JwtPayload) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.usersService.findById(currentUser.sub, transactionalEntityManager),
    );
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users by name or email',
    description:
      'Searches registered users by a free-text query matching name, last name, or email ' +
      '(case-insensitive). Only safe fields (id, name, last_name, email) are returned. ' +
      'Sensitive data such as phone, national ID, and passport are never exposed. ' +
      'Results are capped at 20.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query (matches name, last name, or email)',
    example: 'alice',
  })
  @ApiOkResponse({
    type: [UserSearchResultDto],
    description: 'Matching users (up to 20)',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/users/search' },
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
        { properties: { path: { example: '/users/search' } } },
      ],
    },
  })
  search(@Query('q') query: string): Promise<UserSearchResultDto[]> {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.usersService.search(query, transactionalEntityManager),
    );
  }

  // ===============================================
  // Mutations
  // ===============================================

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Registers a new user. Email, phone number, national ID and passport must all be unique. ' +
      'Password is hashed with scrypt before storage and is never returned in responses.',
  })
  @ApiCreatedResponse({ description: 'User created successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: [
                'email must be an email',
                'password must be longer than or equal to 8 characters',
              ],
            },
            path: { example: '/users' },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'Email, phone number, national ID or passport already in use',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'Email john.doe@example.com is already in use',
            },
            path: { example: '/users' },
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
        { properties: { path: { example: '/users' } } },
      ],
    },
  })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.entityManager.transaction(
      (transactionalEntityManager) =>
        this.usersService.create(dto, transactionalEntityManager),
    );

    void this.emailService
      .sendWelcomeEmail(user.email, { username: user.name })
      .catch((err) => {
        this.logger.error('Failed to send welcome email', err);
      });

    return user;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user profile fields',
    description:
      'Updates one or more profile fields (name, last name, country, national ID, passport, ' +
      'phone number or password). Email is updated via the dedicated PATCH /users/:id/email endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'User updated successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error : invalid UUID or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: {
              example: [
                'phone_number must be longer than or equal to 1 characters',
              ],
            },
            path: {
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'No user with that patient ID exists',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'User with ID a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description:
      'Phone number, national ID or passport already in use by another user',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'Phone number +34600000000 is already in use',
            },
            path: {
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002',
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
            path: { example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002' },
          },
        },
      ],
    },
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.usersService.update(id, dto, transactionalEntityManager),
    );
  }

  @Patch(':id/email')
  @ApiOperation({
    summary: 'Update user email address',
    description:
      "Dedicated endpoint to change a user's email. Email is a unique natural key, so it has " +
      'its own endpoint to ensure all references are updated atomically inside a single transaction.',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Email updated successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error : invalid UUID or malformed email',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['new_email must be an email'] },
            path: {
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002/email',
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
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002/email',
            },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'No user with that patient ID exists',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'User with ID a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: {
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002/email',
            },
          },
        },
      ],
    },
  })
  @ApiConflictResponse({
    description: 'The new email is already in use by another user',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiConflictErrorDto) },
        {
          properties: {
            message: {
              example: 'Email new.email@example.com is already in use',
            },
            path: {
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002/email',
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
              example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002/email',
            },
          },
        },
      ],
    },
  })
  updateEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailDto,
  ) {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.usersService.updateEmail(id, dto, transactionalEntityManager),
    );
  }

  @Delete('me/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete my account (soft-delete)',
    description:
      'Soft-deletes the authenticated user account: anonimizes personal data, ' +
      'cancels pending documents where the user is the sender, and expires ' +
      'pending signature lines where the user is a recipient. ' +
      'All mutations happen inside a single transaction.',
  })
  @ApiOkResponse({ description: 'Account soft-deleted successfully' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'No authentication token provided' },
            path: { example: '/users/me/delete' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'User with ID a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: { example: '/users/me/delete' },
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
        { properties: { path: { example: '/users/me/delete' } } },
      ],
    },
  })
  async deleteMyAccount(@CurrentUser() currentUser: JwtPayload): Promise<{
    message: string;
    cancelled_documents: number;
    expired_recipient_lines: number;
  }> {
    const result = await this.entityManager.transaction(
      (transactionalEntityManager) =>
        this.usersService.deleteMyAccount(
          currentUser.sub,
          transactionalEntityManager,
        ),
    );

    // Fire notification emails asynchronously after transaction commit
    for (const notification of result.notifications.documentCancelled) {
      void this.emailService
        .sendDocumentCancelled(notification.recipientEmail, {
          recipientName: notification.recipientName ?? 'Usuario',
          senderName: notification.senderName,
          documentName: notification.documentTitle,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send document cancelled notification to ${notification.recipientEmail}`,
            err,
          );
        });
    }

    for (const notification of result.notifications.recipientExpired) {
      void this.emailService
        .sendRecipientExpired(notification.ownerEmail, {
          ownerName: notification.ownerName,
          recipientName: notification.recipientName ?? 'Usuario',
          documentName: notification.documentTitle,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send recipient expired notification to ${notification.ownerEmail}`,
            err,
          );
        });
    }

    return {
      message: result.message,
      cancelled_documents: result.cancelled_documents,
      expired_recipient_lines: result.expired_recipient_lines,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently deletes a user record by their patient ID.',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiNoContentResponse({ description: 'User deleted successfully' })
  @ApiBadRequestResponse({
    description: 'Invalid patient UUID',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: 'Validation failed (uuid is expected)' },
            path: { example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002' },
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
            path: { example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'No user with that patient ID exists',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example:
                'User with ID a3bb189e-8bf9-3888-9912-ace4e6543002 not found',
            },
            path: { example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002' },
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
            path: { example: '/users/a3bb189e-8bf9-3888-9912-ace4e6543002' },
          },
        },
      ],
    },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const foundUser = await this.usersService.findById(
          id,
          transactionalEntityManager,
        );
        await this.usersService.remove(id, transactionalEntityManager);
        return foundUser;
      },
    );

    void this.emailService
      .sendAccountDeleted(user.email, `${user.name} ${user.last_name}`)
      .catch((err) => {
        this.logger.error('Failed to send account deleted email', err);
      });
  }
}
