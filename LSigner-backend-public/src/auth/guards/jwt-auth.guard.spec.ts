import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let em: {
    findOne: jest.Mock;
  };
  let jwtService: jest.Mocked<JwtService>;
  let reflector: jest.Mocked<Reflector>;

  function makeMockContext(options: {
    isPublic?: boolean;
    token?: string;
    user?: Record<string, unknown>;
  }): ExecutionContext {
    const request: Record<string, unknown> = {
      headers: options.token
        ? { authorization: `Bearer ${options.token}` }
        : {},
      user: options.user,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  }

  beforeEach(async () => {
    em = {
      findOne: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: getEntityManagerToken(), useValue: em },
        { provide: JwtService, useValue: jwtService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('allows access for non-public routes with valid token and active user', async () => {
      reflector.getAllAndOverride.mockReturnValue(false); // not public
      jwtService.verify.mockReturnValue({
        sub: 'user-uuid',
        email: 'user@example.com',
      });
      em.findOne.mockResolvedValueOnce({
        patient_id: 'user-uuid',
        deleted_at: null,
      });

      const ctx = makeMockContext({
        token: 'valid.jwt.token',
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('rejects access for non-public routes when user is soft-deleted', async () => {
      reflector.getAllAndOverride.mockReturnValue(false); // not public
      jwtService.verify.mockReturnValue({
        sub: 'deleted-uuid',
        email: 'deleted@example.com',
      });
      em.findOne.mockResolvedValueOnce({
        patient_id: 'deleted-uuid',
        deleted_at: new Date(),
      });

      const ctx = makeMockContext({
        token: 'valid.jwt.token',
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('allows access for public routes without token', async () => {
      reflector.getAllAndOverride.mockReturnValue(true); // public

      const ctx = makeMockContext({});
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('allows access for public routes even with deleted user token', async () => {
      reflector.getAllAndOverride.mockReturnValue(true); // public
      jwtService.verify.mockReturnValue({
        sub: 'deleted-uuid',
        email: 'deleted@example.com',
      });

      const ctx = makeMockContext({ token: 'valid.jwt.token' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('throws when no token is provided on non-public route', async () => {
      reflector.getAllAndOverride.mockReturnValue(false); // not public

      const ctx = makeMockContext({});
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when token is invalid on non-public route', async () => {
      reflector.getAllAndOverride.mockReturnValue(false); // not public
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const ctx = makeMockContext({ token: 'bad.token' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when deleted user is not found in DB (missing row)', async () => {
      reflector.getAllAndOverride.mockReturnValue(false); // not public
      jwtService.verify.mockReturnValue({
        sub: 'nonexistent-uuid',
        email: 'ghost@example.com',
      });
      em.findOne.mockResolvedValueOnce(null);

      const ctx = makeMockContext({ token: 'valid.jwt.token' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
