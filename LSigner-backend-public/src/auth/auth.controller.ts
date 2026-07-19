import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ApiBadRequestErrorDto,
  ApiInternalServerErrorDto,
  ApiUnauthorizedErrorDto,
} from '../common/dto/api-error.dto';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokensResponseDto } from './dto/tokens-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './decorators/current-user.decorator';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { VerifyPasswordResponseDto } from './dto/verify-password-response.dto';

@ApiExtraModels(
  ApiBadRequestErrorDto,
  ApiInternalServerErrorDto,
  ApiUnauthorizedErrorDto,
)
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns a short-lived JWT access token and a single-use opaque refresh token.',
  })
  @ApiOkResponse({
    type: TokensResponseDto,
    description: 'Credentials valid : tokens issued',
  })
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
                'password should not be empty',
              ],
            },
            path: { example: '/auth/login' },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'Invalid credentials' },
            path: { example: '/auth/login' },
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
        { properties: { path: { example: '/auth/login' } } },
      ],
    },
  })
  login(@Body() dto: LoginDto): Promise<TokensResponseDto> {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.authService.login(dto, transactionalEntityManager),
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Consumes the provided refresh token (single-use) and returns a new token pair.',
  })
  @ApiOkResponse({
    type: TokensResponseDto,
    description: 'New token pair issued',
  })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['refreshToken should not be empty'] },
            path: { example: '/auth/refresh' },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'Invalid or expired refresh token' },
            path: { example: '/auth/refresh' },
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
        { properties: { path: { example: '/auth/refresh' } } },
      ],
    },
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokensResponseDto> {
    return this.entityManager.transaction((transactionalEntityManager) =>
      this.authService.refresh(dto, transactionalEntityManager),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout : invalidate refresh token',
    description:
      'Revokes the provided refresh token. Requires a valid access token.',
  })
  @ApiNoContentResponse({ description: 'Refresh token revoked' })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['refreshToken should not be empty'] },
            path: { example: '/auth/logout' },
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
            path: { example: '/auth/logout' },
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
        { properties: { path: { example: '/auth/logout' } } },
      ],
    },
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.entityManager.transaction((transactionalEntityManager) =>
      this.authService.logout(dto, transactionalEntityManager),
    );
  }

  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify current password',
    description:
      'Checks whether the provided password matches the stored hash for the authenticated user. ' +
      'Returns 200 with `{ verified: true }` on match, or 401 otherwise. ' +
      'No tokens are issued or revoked : this is a pure verification for gating sensitive operations.',
  })
  @ApiOkResponse({
    type: VerifyPasswordResponseDto,
    description: 'Password matches stored hash',
  })
  @ApiBadRequestResponse({
    description: 'Validation error : missing or malformed fields',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiBadRequestErrorDto) },
        {
          properties: {
            message: { example: ['password should not be empty'] },
            path: { example: '/auth/verify-password' },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid password or missing/invalid access token',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiUnauthorizedErrorDto) },
        {
          properties: {
            message: { example: 'Invalid password' },
            path: { example: '/auth/verify-password' },
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
        { properties: { path: { example: '/auth/verify-password' } } },
      ],
    },
  })
  async verifyPassword(
    @Body() dto: VerifyPasswordDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<VerifyPasswordResponseDto> {
    await this.entityManager.transaction((transactionalEntityManager) =>
      this.authService.verifyUserPassword(
        user.sub,
        dto.password,
        transactionalEntityManager,
      ),
    );

    return { verified: true };
  }
}
