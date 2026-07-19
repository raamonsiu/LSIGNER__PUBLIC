import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { EntityManager } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import {
  ApiBadRequestErrorDto,
  ApiInternalServerErrorDto,
  ApiNotFoundErrorDto,
} from '../common/dto/api-error.dto';
import {
  BootstrapPublicSessionDto,
  BootstrapPublicSessionResponseDto,
} from './dto/bootstrap-public-session.dto';
import { PublicSessionService } from './public-session.service';
import { PUBLIC_SESSION_COOKIE_NAME } from './guards/public-session.guard';
import { extractCookieValue } from '../common/utils/cookie';

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiNotFoundErrorDto,
  ApiInternalServerErrorDto,
)
@ApiTags('public-session')
@Public()
@Controller('v1/public/session')
export class PublicSessionController {
  constructor(
    private readonly publicSessionService: PublicSessionService,
    private readonly configService: ConfigService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @Post('bootstrap')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bootstrap public session from public link id',
    description:
      'Validates a public link identifier. If the recipient is registered, ' +
      'returns AUTH_REQUIRED (the user must log in). If the recipient is anonymous, ' +
      'revokes any previous sessions, creates a new public session, sets an HttpOnly ' +
      'cookie, and returns ANON_ALLOWED with the document ID.',
  })
  @ApiOkResponse({ type: BootstrapPublicSessionResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error — missing or malformed publicLinkId',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['publicLinkId must be a string'] },
            path: { example: '/v1/public/session/bootstrap' },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Invalid, expired, or revoked public link',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiNotFoundErrorDto) },
        {
          properties: {
            message: {
              example: 'Invalid or expired public link',
            },
            path: { example: '/v1/public/session/bootstrap' },
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
        { properties: { path: { example: '/v1/public/session/bootstrap' } } },
      ],
    },
  })
  async bootstrap(
    @Body() dto: BootstrapPublicSessionDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BootstrapPublicSessionResponseDto> {
    const result = await this.entityManager.transaction(
      (transactionalEntityManager) =>
        this.publicSessionService.bootstrapSession(
          dto.publicLinkId,
          {
            ip: request.ip ?? null,
            userAgent: request.get('user-agent') ?? null,
          },
          transactionalEntityManager,
        ),
    );

    if (result.status === 'ANON_ALLOWED' && result.sessionToken) {
      response.cookie(PUBLIC_SESSION_COOKIE_NAME, result.sessionToken, {
        httpOnly: true,
        secure: this.configService.get<string>('app.env') === 'production',
        sameSite: 'lax',
        maxAge: this.publicSessionService.getSessionCookieMaxAgeMs(),
        path: '/',
      });
    }

    return {
      status: result.status,
      documentId: result.documentId,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout public session' })
  @ApiNoContentResponse({ description: 'Public session cleared' })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiInternalServerErrorDto) },
        { properties: { path: { example: '/v1/public/session/logout' } } },
      ],
    },
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookieHeader = request.headers.cookie;
    const sessionToken = extractCookieValue(
      cookieHeader,
      PUBLIC_SESSION_COOKIE_NAME,
    );

    if (sessionToken) {
      await this.entityManager.transaction((transactionalEntityManager) =>
        this.publicSessionService.revokeSession(
          sessionToken,
          transactionalEntityManager,
        ),
      );
    }

    response.clearCookie(PUBLIC_SESSION_COOKIE_NAME, {
      path: '/',
    });
  }
}
