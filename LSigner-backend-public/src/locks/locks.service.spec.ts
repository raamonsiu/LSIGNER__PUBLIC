import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, QueryFailedError, SelectQueryBuilder } from 'typeorm';
import { LocksService } from './locks.service';
import { LockHandlerRegistry } from './lock-handler.registry';
import { DocumentLock, LockType } from '../entities/document-lock.entity';
import { DocumentRecipient } from '../entities/document-recipient.entity';
import { ResolveLockDto } from './dto/resolve-lock.dto';
import { ApplyLockDto } from './dto/apply-lock.dto';

// Fixtures

const DOC_ID = 'aaaa0000-0000-0000-0000-000000000001';
const LOCK_ID = 'bbbb0000-0000-0000-0000-000000000002';
const RECIPIENT_ID = 'cccc0000-0000-0000-0000-000000000003';
const USER_ID = 'dddd0000-0000-0000-0000-000000000004';

function makeLock(overrides: Partial<DocumentLock> = {}): DocumentLock {
  return {
    id: LOCK_ID,
    document_id: DOC_ID,
    lock_type: LockType.PASSWORD,
    config: { hash: 'fakehash', salt: 'fakesalt' },
    resolutions: [],
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    document: {} as any,
    ...overrides,
  };
}

function makeRecipient(
  overrides: Partial<DocumentRecipient> = {},
): DocumentRecipient {
  return {
    id: RECIPIENT_ID,
    document_id: DOC_ID,
    user_id: USER_ID,
    recipient_email: 'alice@example.com',
    recipient_name: 'Alice',
    status: 'PENDING' as any,
    sent_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    document: {} as any,
    user: null,
    ...overrides,
  };
}

// Suite

describe('LocksService', () => {
  let service: LocksService;
  let em: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let registry: { get: jest.Mock };
  let qb: Partial<SelectQueryBuilder<DocumentLock>>;

  beforeEach(async () => {
    qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getCount: jest.fn(),
    };

    em = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
        ...data,
      })),
      save: jest.fn((entity) =>
        Array.isArray(entity)
          ? Promise.resolve(entity)
          : Promise.resolve({ id: LOCK_ID, ...entity }),
      ),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    registry = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocksService,
        { provide: EntityManager, useValue: em },
        { provide: LockHandlerRegistry, useValue: registry },
      ],
    }).compile();

    service = module.get(LocksService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── applyLocks ──────────────────────────────────────────────────────────────

  interface Lock {
    type: LockType;
    password: string;
  }

  describe('applyLocks', () => {
    it('calls the handler and persists lock records', async () => {
      const mockConfig = { hash: 'h', salt: 's' };
      const mockHandler = { apply: jest.fn().mockResolvedValue(mockConfig) };
      registry.get.mockReturnValue(mockHandler);

      const locks: ApplyLockDto[] = [
        { type: LockType.PASSWORD, password: 'secret123' },
      ];

      const result = await service.applyLocks(
        DOC_ID,
        locks,
        em as unknown as EntityManager,
      );

      expect(registry.get).toHaveBeenCalledWith(LockType.PASSWORD);
      expect(mockHandler.apply).toHaveBeenCalledWith({
        type: LockType.PASSWORD,
        password: 'secret123',
      });
      expect(em.create).toHaveBeenCalledWith(DocumentLock, {
        document_id: DOC_ID,
        lock_type: LockType.PASSWORD,
        config: mockConfig,
      });
      expect(em.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('applies multiple locks in a single save', async () => {
      const mockHandler = {
        apply: jest.fn().mockResolvedValue({ hash: 'h', salt: 's' }),
      };
      registry.get.mockReturnValue(mockHandler);

      const locks: ApplyLockDto[] = [
        { type: LockType.PASSWORD, password: 'pass1' },
        { type: LockType.PASSWORD, password: 'pass2' },
      ];

      await service.applyLocks(DOC_ID, locks, em as unknown as EntityManager);

      expect(em.save).toHaveBeenCalledTimes(1);
      const calls = em.save.mock.calls as unknown as [Lock[]][];
      const savedArray: Lock[] = calls[0][0];
      expect(savedArray).toHaveLength(2);
    });
  });

  // ── resolveLock ─────────────────────────────────────────────────────────────

  describe('resolveLock', () => {
    const dto: ResolveLockDto = { password: 'secret123' };

    it('resolves a lock successfully', async () => {
      const lock = makeLock();
      (qb.getOne as jest.Mock).mockResolvedValue(lock);
      em.findOne.mockResolvedValueOnce(makeRecipient()); // DocumentRecipient
      const mockHandler = { verify: jest.fn().mockResolvedValue(undefined) };
      registry.get.mockReturnValue(mockHandler);

      await service.resolveLock(
        LOCK_ID,
        DOC_ID,
        USER_ID,
        dto,
        em as unknown as EntityManager,
      );

      expect(mockHandler.verify).toHaveBeenCalledWith(lock.config, dto);
      expect(em.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when lock does not belong to document', async () => {
      (qb.getOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveLock(
          LOCK_ID,
          DOC_ID,
          USER_ID,
          dto,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a recipient', async () => {
      (qb.getOne as jest.Mock).mockResolvedValue(makeLock());
      em.findOne.mockResolvedValueOnce(null); // no recipient found

      await expect(
        service.resolveLock(
          LOCK_ID,
          DOC_ID,
          USER_ID,
          dto,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the DB unique constraint fires on concurrent resolution', async () => {
      (qb.getOne as jest.Mock).mockResolvedValue(makeLock());
      em.findOne.mockResolvedValueOnce(makeRecipient());
      const mockHandler = { verify: jest.fn().mockResolvedValue(undefined) };
      registry.get.mockReturnValue(mockHandler);

      // Simulate Postgres unique-violation (code 23505) thrown by save()
      const uniqueError = Object.assign(
        new QueryFailedError('INSERT', [], new Error()),
        { code: '23505' },
      );
      em.save.mockRejectedValueOnce(uniqueError);

      await expect(
        service.resolveLock(
          LOCK_ID,
          DOC_ID,
          USER_ID,
          dto,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws unexpected errors from save()', async () => {
      (qb.getOne as jest.Mock).mockResolvedValue(makeLock());
      em.findOne.mockResolvedValueOnce(makeRecipient());
      const mockHandler = { verify: jest.fn().mockResolvedValue(undefined) };
      registry.get.mockReturnValue(mockHandler);

      const unexpectedError = new Error('disk full');
      em.save.mockRejectedValueOnce(unexpectedError);

      await expect(
        service.resolveLock(
          LOCK_ID,
          DOC_ID,
          USER_ID,
          dto,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow('disk full');
    });

    it('propagates UnauthorizedException from the handler', async () => {
      (qb.getOne as jest.Mock).mockResolvedValue(makeLock());
      em.findOne.mockResolvedValueOnce(makeRecipient());
      const mockHandler = {
        verify: jest
          .fn()
          .mockRejectedValue(
            new UnauthorizedException('Incorrect lock password'),
          ),
      };
      registry.get.mockReturnValue(mockHandler);

      await expect(
        service.resolveLock(
          LOCK_ID,
          DOC_ID,
          USER_ID,
          dto,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getLocksForDocument ─────────────────────────────────────────────────────
  interface Document {
    id: string;
    owner_id: string;
  }

  describe('getLocksForDocument', () => {
    function makeDoc(ownerId = 'other-owner-id'): Document {
      return { id: DOC_ID, owner_id: ownerId };
    }

    it('throws NotFoundException when document does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null); // document not found

      await expect(
        service.getLocksForDocument(
          DOC_ID,
          USER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not owner or recipient', async () => {
      em.findOne
        .mockResolvedValueOnce(makeDoc('other-owner')) // document (user is not owner)
        .mockResolvedValueOnce(null); // no recipient record found

      await expect(
        service.getLocksForDocument(
          DOC_ID,
          USER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns empty array when no locks exist (recipient)', async () => {
      em.findOne
        .mockResolvedValueOnce(makeDoc('other-owner')) // document
        .mockResolvedValueOnce(makeRecipient()); // recipient record found
      em.find.mockResolvedValueOnce([]); // no locks

      const result = await service.getLocksForDocument(
        DOC_ID,
        USER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when no locks exist (owner)', async () => {
      em.findOne.mockResolvedValueOnce(makeDoc(USER_ID)); // document — user is owner
      em.find.mockResolvedValueOnce([]); // no locks

      const result = await service.getLocksForDocument(
        DOC_ID,
        USER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toEqual([]);
    });

    it('returns locks with is_resolved=false when user has no resolutions', async () => {
      em.findOne
        .mockResolvedValueOnce(makeDoc('other-owner')) // document
        .mockResolvedValueOnce(makeRecipient()); // recipient
      em.find
        .mockResolvedValueOnce([makeLock()]) // locks
        .mockResolvedValueOnce([]); // resolutions

      const result = await service.getLocksForDocument(
        DOC_ID,
        USER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(LOCK_ID);
      expect(result[0].is_resolved).toBe(false);
      expect(result[0].resolved_at).toBeNull();
    });

    it('returns is_resolved=true with resolved_at when resolution exists', async () => {
      const resolvedAt = new Date('2026-04-01');
      em.findOne
        .mockResolvedValueOnce(makeDoc('other-owner'))
        .mockResolvedValueOnce(makeRecipient());
      em.find
        .mockResolvedValueOnce([makeLock()])
        .mockResolvedValueOnce([{ lock_id: LOCK_ID, resolved_at: resolvedAt }]);

      const result = await service.getLocksForDocument(
        DOC_ID,
        USER_ID,
        em as unknown as EntityManager,
      );

      expect(result[0].is_resolved).toBe(true);
      expect(result[0].resolved_at).toBe(resolvedAt);
    });

    it('returns locks with is_resolved=false for the owner (resolutions skipped)', async () => {
      em.findOne.mockResolvedValueOnce(makeDoc(USER_ID)); // user is owner
      em.find.mockResolvedValueOnce([makeLock()]); // locks (no resolutions queried)

      const result = await service.getLocksForDocument(
        DOC_ID,
        USER_ID,
        em as unknown as EntityManager,
      );

      expect(result[0].is_resolved).toBe(false);
      // Resolutions find should NOT have been called for owners
      expect(em.find).toHaveBeenCalledTimes(1);
    });
  });

  // ── hasUnresolvedLocks ──────────────────────────────────────────────────────

  describe('hasUnresolvedLocks', () => {
    it('returns true when there are unresolved locks', async () => {
      (qb.getCount as jest.Mock).mockResolvedValue(1);

      const result = await service.hasUnresolvedLocks(
        DOC_ID,
        RECIPIENT_ID,
        em as unknown as EntityManager,
      );

      expect(result).toBe(true);
    });

    it('returns false when all locks are resolved', async () => {
      (qb.getCount as jest.Mock).mockResolvedValue(0);

      const result = await service.hasUnresolvedLocks(
        DOC_ID,
        RECIPIENT_ID,
        em as unknown as EntityManager,
      );

      expect(result).toBe(false);
    });
  });
});
