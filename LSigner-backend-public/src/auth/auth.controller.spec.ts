import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokensResponseDto } from './dto/tokens-response.dto';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TOKENS: TokensResponseDto = {
  access_token: 'eyJ.access.token',
  refresh_token: 'opaque-refresh-token',
  expires_in: 900,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService: Partial<jest.Mocked<AuthService>> = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      verifyUserPassword: jest.fn(),
    };

    // Mock EntityManager: transaction just invokes the callback with itself
    const mockEntityManager = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: unknown) => unknown) =>
          cb(mockEntityManager),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: getEntityManagerToken(), useValue: mockEntityManager },
        // Provide enough for JwtAuthGuard override
        JwtService,
        Reflector,
      ],
    })
      // Override the global guard so we can test without a real JWT
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── POST /auth/login ───────────────────────────────────────────────────────

  describe('login', () => {
    it('delegates to AuthService and returns the token pair', async () => {
      authService.login.mockResolvedValue(TOKENS);

      const result = await controller.login({
        email: 'john@example.com',
        password: 'Str0ngP@ssword!',
      });

      expect(authService.login).toHaveBeenCalledWith(
        { email: 'john@example.com', password: 'Str0ngP@ssword!' },
        expect.anything(),
      );
      expect(result).toEqual(TOKENS);
    });

    it('propagates UnauthorizedException on invalid credentials', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login({ email: 'x@y.com', password: 'wrong123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('refresh', () => {
    it('delegates to AuthService and returns a new token pair', async () => {
      authService.refresh.mockResolvedValue(TOKENS);

      const result = await controller.refresh({
        refresh_token: 'opaque-refresh-token',
      });

      expect(authService.refresh).toHaveBeenCalledWith(
        { refresh_token: 'opaque-refresh-token' },
        expect.anything(),
      );
      expect(result).toEqual(TOKENS);
    });

    it('propagates UnauthorizedException on invalid refresh token', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      await expect(
        controller.refresh({ refresh_token: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('logout', () => {
    it('delegates to AuthService and returns void', async () => {
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout({
        refresh_token: 'opaque-refresh-token',
      });

      expect(authService.logout).toHaveBeenCalledWith(
        { refresh_token: 'opaque-refresh-token' },
        expect.anything(),
      );
      expect(result).toBeUndefined();
    });
  });

  // ── POST /auth/verify-password ────────────────────────────────────────────

  describe('verifyPassword', () => {
    const USER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
    const USER_EMAIL = 'john@example.com';

    it('delegates to AuthService and returns verified: true', async () => {
      authService.verifyUserPassword.mockResolvedValue(undefined);

      const result = await controller.verifyPassword(
        { password: 'Str0ngP@ssword!' },
        { sub: USER_ID, email: USER_EMAIL },
      );

      expect(authService.verifyUserPassword).toHaveBeenCalledWith(
        USER_ID,
        'Str0ngP@ssword!',
        expect.anything(),
      );
      expect(result).toEqual({ verified: true });
    });

    it('propagates UnauthorizedException on wrong password', async () => {
      authService.verifyUserPassword.mockRejectedValue(
        new UnauthorizedException('Invalid password'),
      );

      await expect(
        controller.verifyPassword(
          { password: 'WrongPassword1!' },
          { sub: USER_ID, email: USER_EMAIL },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
