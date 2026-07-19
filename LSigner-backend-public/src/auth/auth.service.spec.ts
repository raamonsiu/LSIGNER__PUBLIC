import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import * as crypto from 'crypto';
import { promisify } from 'util';

// ── Helpers ───────────────────────────────────────────────────────────────────

const scrypt = promisify(crypto.scrypt);

async function makeHash(plain: string, salt: string): Promise<string> {
  const derived = (await scrypt(plain, salt, 64)) as Buffer;
  return derived.toString('hex');
}

const USER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const USER_EMAIL = 'john@example.com';
const PLAIN_PASSWORD = 'Str0ngP@ssword!';
const SALT = crypto.randomBytes(32).toString('hex');

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let em: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    transaction: jest.Mock;
  };
  let jwtService: jest.Mocked<JwtService>;

  // Lazily-filled with real hash after async setup
  let realHash: string;

  beforeAll(async () => {
    realHash = await makeHash(PLAIN_PASSWORD, SALT);
  });

  function makeUserRow(overrides: Partial<User> = {}): User {
    return {
      patient_id: USER_ID,
      name: 'John',
      last_name: 'Doe',
      country: 'Spain',
      national_id: null,
      passport: null,
      email: USER_EMAIL,
      phone_number: '+34600000000',
      password: realHash,
      salt: SALT,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  function makeRefreshRecord(
    overrides: Partial<RefreshToken> = {},
  ): RefreshToken {
    return {
      id: 'rt-uuid',
      user_id: USER_ID,
      user: makeUserRow(),
      token_hash: 'deadbeef'.repeat(8), // 64-char placeholder
      expires_at: new Date(Date.now() + 7 * 86_400_000),
      revoked: false,
      created_at: new Date(),
      ...overrides,
    };
  }

  // Query-builder mock chain — result is User (login) or RefreshToken (refresh)
  function mockQB(result: User | RefreshToken | null) {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
    };
    em.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  beforeEach(async () => {
    em = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((entity: object) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({}),
      create: jest
        .fn()
        .mockImplementation(
          (_entityClass: unknown, data: object): object => data,
        ),
      // Passes the same em to the callback so tests work without a real DB transaction
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: unknown) => unknown) => cb(em)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getEntityManagerToken(),
          useValue: em,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth.jwtExpiresIn') return '15m';
              if (key === 'auth.jwtRefreshExpiresIn') return '7d';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns token pair on valid credentials', async () => {
      mockQB(makeUserRow());

      const result = await service.login({
        email: USER_EMAIL,
        password: PLAIN_PASSWORD,
      });

      expect(result).toMatchObject({
        access_token: 'signed.jwt.token',
        expires_in: 900, // 15 min
      });
      expect(typeof result.refresh_token).toBe('string');
      expect(result.refresh_token.length).toBeGreaterThan(0);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: USER_ID, email: USER_EMAIL },
        { expiresIn: '15m' },
      );
    });

    it('persists a refresh-token record on successful login', async () => {
      mockQB(makeUserRow());

      await service.login({ email: USER_EMAIL, password: PLAIN_PASSWORD });

      expect(em.save).toHaveBeenCalled();
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockQB(makeUserRow());

      await expect(
        service.login({ email: USER_EMAIL, password: 'WrongPassword1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      mockQB(null);

      await expect(
        service.login({
          email: 'nobody@example.com',
          password: PLAIN_PASSWORD,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('always runs password comparison even when user is missing (timing safety)', async () => {
      mockQB(null);

      // Spy on the private verifyPassword method to confirm it was called even
      // when no user row exists, preventing short-circuit user-enumeration.
      const verifyPasswordSpy = jest.spyOn(
        service as unknown as { verifyPassword: () => Promise<boolean> },
        'verifyPassword',
      );

      await expect(
        service.login({ email: 'ghost@example.com', password: PLAIN_PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);

      expect(verifyPasswordSpy).toHaveBeenCalled();
      verifyPasswordSpy.mockRestore();
    });

    it('throws UnauthorizedException when user account is soft-deleted', async () => {
      mockQB(makeUserRow({ deleted_at: new Date() }));

      await expect(
        service.login({ email: USER_EMAIL, password: PLAIN_PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('issues new tokens and revokes the old refresh record', async () => {
      const stored = makeRefreshRecord();
      mockQB(stored); // refresh token lookup via query builder
      em.findOne.mockResolvedValueOnce(makeUserRow()); // user lookup

      const rawToken = 'a'.repeat(96); // fake 96-char hex token
      const result = await service.refresh({ refresh_token: rawToken });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(typeof result.refresh_token).toBe('string');
      // Old record should have been saved with revoked = true
      expect(em.save).toHaveBeenCalledWith(
        expect.objectContaining({ revoked: true }),
      );
    });

    it('throws when refresh token is not found', async () => {
      mockQB(null);

      await expect(
        service.refresh({ refresh_token: 'invalid' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when refresh token is expired', async () => {
      const expired = makeRefreshRecord({
        expires_at: new Date(Date.now() - 1000),
      });
      mockQB(expired);

      await expect(
        service.refresh({ refresh_token: 'a'.repeat(96) }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── verifyUserPassword ─────────────────────────────────────────────────────

  describe('verifyUserPassword', () => {
    it('resolves on correct password', async () => {
      mockQB(makeUserRow());

      await expect(
        service.verifyUserPassword(USER_ID, PLAIN_PASSWORD),
      ).resolves.toBeUndefined();
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockQB(makeUserRow());

      await expect(
        service.verifyUserPassword(USER_ID, 'WrongPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      mockQB(null);

      await expect(
        service.verifyUserPassword(USER_ID, PLAIN_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('always runs password comparison even when user is missing (timing safety)', async () => {
      mockQB(null);

      const verifyPasswordSpy = jest.spyOn(
        service as unknown as { verifyPassword: () => Promise<boolean> },
        'verifyPassword',
      );

      await expect(
        service.verifyUserPassword(USER_ID, PLAIN_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);

      expect(verifyPasswordSpy).toHaveBeenCalled();
      verifyPasswordSpy.mockRestore();
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the refresh token via update', async () => {
      em.update.mockResolvedValueOnce({});

      await service.logout({ refresh_token: 'a'.repeat(96) });

      expect(em.update).toHaveBeenCalledWith(
        RefreshToken,
        expect.objectContaining({ revoked: false }),
        { revoked: true },
      );
    });

    it('does not throw when token is already revoked / unknown', async () => {
      em.update.mockResolvedValueOnce({});

      await expect(
        service.logout({ refresh_token: 'nonexistent' }),
      ).resolves.toBeUndefined();
    });
  });
});
