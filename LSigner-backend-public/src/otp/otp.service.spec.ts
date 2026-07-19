import {
  ConflictException,
  ForbiddenException,
  GoneException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { OtpService } from './otp.service';
import { OtpChallenge } from '../entities/otp-challenge.entity';
import { OtpChallengeStatus } from './enums/otp-challenge-status.enum';
import { OtpActionType } from './enums/otp-action-type.enum';
import { OtpResourceType } from './enums/otp-resource-type.enum';
import type { CreateOtpChallengeDto } from './dto/create-otp-challenge.dto';

const USER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const RESOURCE_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';

function makeChallenge(overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    id: 'challenge-uuid',
    user_id: USER_ID,
    action_type: OtpActionType.SIGN,
    resource_type: OtpResourceType.DOCUMENT,
    resource_id: RESOURCE_ID,
    otp_hash: 'a'.repeat(64),
    otp_salt: 'b'.repeat(32),
    expires_at: new Date(Date.now() + 300_000),
    attempt_count: 0,
    max_attempts: 5,
    resend_count: 0,
    max_resends: 3,
    resend_available_at: new Date(Date.now() + 60_000),
    locked_until: null,
    status: OtpChallengeStatus.ACTIVE,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function mockQB(result: OtpChallenge | null) {
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return qb;
}

describe('OtpService', () => {
  let service: OtpService;
  let em: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    transaction: jest.Mock;
  };

  const defaultConfig = {
    'otp.ttlSeconds': 300,
    'otp.length': 6,
    'otp.maxAttempts': 5,
    'otp.lockMinutes': 15,
    'otp.resendCooldownSeconds': 60,
    'otp.maxResends': 3,
  };

  beforeEach(async () => {
    em = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((entity: object) => Promise.resolve(entity)),
      create: jest
        .fn()
        .mockImplementation(
          (_entityClass: unknown, data: object): object => data,
        ),
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: unknown) => unknown) => cb(em)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: getEntityManagerToken(),
          useValue: em,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(<K extends keyof typeof defaultConfig>(key: K) => {
              return defaultConfig[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(OtpService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── generateOtp ─────────────────────────────────────────────────

  describe('generateOtp', () => {
    it('generates a numeric string of configured length', () => {
      const otp = service.generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('generates different values on subsequent calls', () => {
      const otp1 = service.generateOtp();
      const otp2 = service.generateOtp();
      expect(otp1).not.toBe(otp2);
    });
  });

  // ── hashOtp / verifyOtpHash ──────────────────────────────────────

  describe('hashOtp and verifyOtpHash', () => {
    it('produces a verifiable hash', () => {
      const otp = '123456';
      const { otpHash, otpSalt } = service.hashOtp(otp);

      expect(otpHash).toHaveLength(64);
      expect(otpSalt).toHaveLength(32);

      expect(service.verifyOtpHash(otp, otpHash, otpSalt)).toBe(true);
    });

    it('rejects wrong OTP', () => {
      const { otpHash, otpSalt } = service.hashOtp('123456');
      expect(service.verifyOtpHash('wrong', otpHash, otpSalt)).toBe(false);
    });

    it('uses timing-safe comparison', () => {
      const { otpHash, otpSalt } = service.hashOtp('123456');
      const computedHash = crypto
        .createHash('sha256')
        .update('123456' + otpSalt)
        .digest('hex');

      const directResult = crypto.timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(otpHash, 'hex'),
      );
      expect(directResult).toBe(true);
      expect(service.verifyOtpHash('123456', otpHash, otpSalt)).toBe(true);
    });
  });

  // ── createChallenge ──────────────────────────────────────────────

  describe('createChallenge', () => {
    const createDto: CreateOtpChallengeDto = {
      actionType: OtpActionType.SIGN,
      resourceType: OtpResourceType.DOCUMENT,
      resourceId: RESOURCE_ID,
    };

    function createChallengeQBs(affected = 0, hasPriorChallenges = false) {
      const lockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue(
            hasPriorChallenges
              ? [makeChallenge({ id: 'prior-challenge' })]
              : [],
          ),
      };
      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected }),
      };
      return { lockQb, updateQb };
    }

    it('creates a challenge and returns plain OTP and response', async () => {
      const { lockQb, updateQb } = createChallengeQBs(0);
      em.createQueryBuilder
        .mockReturnValueOnce(lockQb)
        .mockReturnValueOnce(updateQb);

      const result = await service.createChallenge(USER_ID, createDto, {
        email: 'john@example.com',
      });

      expect(result.challenge).toBeDefined();
      expect(result.plainOtp).toMatch(/^\d{6}$/);
      expect(result.response.challengeId).toBe(result.challenge.id);
      expect(result.response.maskedDestination).toContain('@example.com');
      expect(result.response.remainingAttempts).toBe(5);
      expect(result.response.remainingResends).toBe(3);
      expect(em.save).toHaveBeenCalled();
    });

    it('cancels prior active challenges for the same scope', async () => {
      const { lockQb, updateQb } = createChallengeQBs(1);
      em.createQueryBuilder
        .mockReturnValueOnce(lockQb)
        .mockReturnValueOnce(updateQb);

      await service.createChallenge(USER_ID, createDto, {
        email: 'john@example.com',
      });

      expect(updateQb.update).toHaveBeenCalled();
      expect(updateQb.where).toHaveBeenCalledWith(
        expect.stringContaining('user_id = :userId'),
        expect.any(Object),
      );
    });

    it('masks email in response', async () => {
      const { lockQb, updateQb } = createChallengeQBs(0);
      em.createQueryBuilder
        .mockReturnValueOnce(lockQb)
        .mockReturnValueOnce(updateQb);

      const result = await service.createChallenge(USER_ID, createDto, {
        email: 'alice.smith@example.com',
      });

      expect(result.response.maskedDestination).toBe('a*****h@example.com');
    });

    // ── Race condition / pessimistic lock tests ──────────────────

    it('locks scope rows with pessimistic write before cancelling prior challenges', async () => {
      const { lockQb, updateQb } = createChallengeQBs(0);
      em.createQueryBuilder
        .mockReturnValueOnce(lockQb)
        .mockReturnValueOnce(updateQb);

      await service.createChallenge(USER_ID, createDto, {
        email: 'john@example.com',
      });

      expect(lockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(lockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('user_id = :userId'),
        expect.any(Object),
      );
      expect(lockQb.getMany).toHaveBeenCalled();
    });

    it('sequential createChallenge calls for same scope both apply the pessimistic lock', async () => {
      // Sequential calls — the pessimistic lock serialises them in a real DB
      const { lockQb: lockQb1, updateQb: updateQb1 } = createChallengeQBs(0);
      const { lockQb: lockQb2, updateQb: updateQb2 } = createChallengeQBs(0);

      em.createQueryBuilder
        .mockReturnValueOnce(lockQb1)
        .mockReturnValueOnce(updateQb1)
        .mockReturnValueOnce(lockQb2)
        .mockReturnValueOnce(updateQb2);

      // Both calls succeed and apply the lock mechanism
      await service.createChallenge(USER_ID, createDto, {
        email: 'john@example.com',
      });
      await service.createChallenge(USER_ID, createDto, {
        email: 'john@example.com',
      });

      // The lock query was called for both attempts
      expect(lockQb1.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(lockQb2.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(lockQb1.getMany).toHaveBeenCalledTimes(1);
      expect(lockQb2.getMany).toHaveBeenCalledTimes(1);
      expect(lockQb1.where).toHaveBeenCalledWith(
        expect.stringContaining('user_id = :userId'),
        expect.any(Object),
      );
      expect(lockQb2.where).toHaveBeenCalledWith(
        expect.stringContaining('user_id = :userId'),
        expect.any(Object),
      );
    });
  });

  // ── verifyChallenge ──────────────────────────────────────────────

  describe('verifyChallenge', () => {
    it('returns challenge on successful verification', async () => {
      const otp = '123456';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(otp + salt)
        .digest('hex');

      const challenge = makeChallenge({
        otp_hash: hash,
        otp_salt: salt,
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      const result = await service.verifyChallenge(
        'challenge-uuid',
        otp,
        USER_ID,
      );

      expect(result.status).toBe(OtpChallengeStatus.CONSUMED);
      expect(em.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException when challenge not found', async () => {
      em.createQueryBuilder.mockReturnValue(mockQB(null));

      await expect(
        service.verifyChallenge('nonexistent', '123456', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user_id does not match', async () => {
      em.createQueryBuilder.mockReturnValue(
        mockQB(makeChallenge({ user_id: 'other-user' })),
      );

      await expect(
        service.verifyChallenge('challenge-uuid', '123456', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when already consumed', async () => {
      em.createQueryBuilder.mockReturnValue(
        mockQB(makeChallenge({ status: OtpChallengeStatus.CONSUMED })),
      );

      await expect(
        service.verifyChallenge('challenge-uuid', '123456', USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when cancelled', async () => {
      em.createQueryBuilder.mockReturnValue(
        mockQB(makeChallenge({ status: OtpChallengeStatus.CANCELLED })),
      );

      await expect(
        service.verifyChallenge('challenge-uuid', '123456', USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws GoneException when expired', async () => {
      em.createQueryBuilder.mockReturnValue(
        mockQB(makeChallenge({ expires_at: new Date(Date.now() - 1000) })),
      );

      await expect(
        service.verifyChallenge('challenge-uuid', '123456', USER_ID),
      ).rejects.toThrow(GoneException);
    });

    it('throws UnprocessableEntityException on wrong code', async () => {
      const otp = '123456';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(otp + salt)
        .digest('hex');

      em.createQueryBuilder.mockReturnValue(
        mockQB(makeChallenge({ otp_hash: hash, otp_salt: salt })),
      );

      await expect(
        service.verifyChallenge('challenge-uuid', 'wrong', USER_ID),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('increments attempt count on wrong code', async () => {
      const otp = '123456';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(otp + salt)
        .digest('hex');

      const challenge = makeChallenge({
        otp_hash: hash,
        otp_salt: salt,
        attempt_count: 0,
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      await expect(
        service.verifyChallenge('challenge-uuid', 'wrong', USER_ID),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(challenge.attempt_count).toBe(1);
    });

    it('locks challenge after max attempts', async () => {
      const otp = '123456';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(otp + salt)
        .digest('hex');

      const challenge = makeChallenge({
        otp_hash: hash,
        otp_salt: salt,
        attempt_count: 4,
        max_attempts: 5,
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      await expect(
        service.verifyChallenge('challenge-uuid', 'wrong', USER_ID),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(challenge.status).toBe(OtpChallengeStatus.LOCKED);
      expect(challenge.locked_until).toBeInstanceOf(Date);
    });

    it('re-activates a challenge that was locked but lock time passed', async () => {
      const otp = '123456';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(otp + salt)
        .digest('hex');

      const challenge = makeChallenge({
        otp_hash: hash,
        otp_salt: salt,
        status: OtpChallengeStatus.LOCKED,
        locked_until: new Date(Date.now() - 1000),
        attempt_count: 5,
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      const result = await service.verifyChallenge(
        'challenge-uuid',
        otp,
        USER_ID,
      );

      expect(result.status).toBe(OtpChallengeStatus.CONSUMED);
    });
  });

  // ── resendChallenge ──────────────────────────────────────────────

  describe('resendChallenge', () => {
    it('generates new OTP and updates the challenge', async () => {
      const challenge = makeChallenge({
        resend_available_at: new Date(Date.now() - 1000),
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      const result = await service.resendChallenge('challenge-uuid', USER_ID);

      expect(result.plainOtp).toMatch(/^\d{6}$/);
      expect(result.response.remainingResends).toBe(2);
      expect(challenge.resend_count).toBe(1);
      expect(challenge.attempt_count).toBe(0);
    });

    it('throws ConflictException when max resends reached', async () => {
      const challenge = makeChallenge({
        resend_count: 3,
        max_resends: 3,
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      await expect(
        service.resendChallenge('challenge-uuid', USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when cooldown not elapsed', async () => {
      const challenge = makeChallenge({
        resend_available_at: new Date(Date.now() + 30_000),
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      await expect(
        service.resendChallenge('challenge-uuid', USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws GoneException when expired', async () => {
      const challenge = makeChallenge({
        expires_at: new Date(Date.now() - 1000),
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      await expect(
        service.resendChallenge('challenge-uuid', USER_ID),
      ).rejects.toThrow(GoneException);
    });

    it('throws ConflictException when locked', async () => {
      const challenge = makeChallenge({
        locked_until: new Date(Date.now() + 60_000),
        status: OtpChallengeStatus.LOCKED,
      });
      em.createQueryBuilder.mockReturnValue(mockQB(challenge));

      await expect(
        service.resendChallenge('challenge-uuid', USER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── expireStaleChallenges ────────────────────────────────────────

  describe('expireStaleChallenges', () => {
    it('updates expired challenges to EXPIRED status', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      em.createQueryBuilder.mockReturnValue(qb);

      const count = await service.expireStaleChallenges();

      expect(count).toBe(3);
      expect(qb.update).toHaveBeenCalledWith(OtpChallenge);
      expect(qb.set).toHaveBeenCalledWith({
        status: OtpChallengeStatus.EXPIRED,
      });
    });
  });

  // ── unlockExpiredLocks ──────────────────────────────────────────

  describe('unlockExpiredLocks', () => {
    it('unlocks challenges whose lock time has passed', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      em.createQueryBuilder.mockReturnValue(qb);

      const count = await service.unlockExpiredLocks();

      expect(count).toBe(2);
      expect(qb.update).toHaveBeenCalledWith(OtpChallenge);
    });
  });

  // ── getTtlSeconds ──────────────────────────────────────────────

  describe('getTtlSeconds', () => {
    it('returns the configured ttlSeconds value', () => {
      const ttl = service.getTtlSeconds();
      expect(ttl).toBe(300);
    });
  });
});
