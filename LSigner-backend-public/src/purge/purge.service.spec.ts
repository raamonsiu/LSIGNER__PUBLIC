import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { PurgeService } from './purge.service';
import { User } from '../entities/user.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const EXPIRED_USER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const RECENT_USER_ID = 'b4cc290f-9ca0-4999-0023-bdf5f7654113';

const thirteenMonthsAgo = new Date();
thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

const elevenMonthsAgo = new Date();
elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PurgeService', () => {
  let service: PurgeService;
  let em: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    em = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn((_entity: unknown, data: object) => data),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PurgeService, { provide: EntityManager, useValue: em }],
    }).compile();

    service = module.get(PurgeService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('purgeExpiredRecords', () => {
    it('purges users deleted more than 12 months ago', async () => {
      const expiredUser = {
        patient_id: EXPIRED_USER_ID,
        name: 'Usuario eliminado',
        last_name: '',
        email: null,
        phone_number: null,
        deleted_at: thirteenMonthsAgo,
      } as User;

      em.find
        .mockResolvedValueOnce([expiredUser]) // expired users
        .mockResolvedValueOnce([]) // no cancelled docs
        .mockResolvedValueOnce([]); // no expired recipients

      const result = await service.purgeExpiredRecords(
        em as unknown as EntityManager,
      );

      // Verify the expired user was queried with the right criteria
      expect(em.find).toHaveBeenNthCalledWith(1, User, {
        where: expect.objectContaining({
          deleted_at: expect.any(Object), // LessThan comparison
        }),
      });
      // Verify the user was removed
      expect(em.remove).toHaveBeenCalledWith(expiredUser);
      expect(result.purged_users).toBe(1);
      expect(result.purged_documents).toBe(0);
      expect(result.purged_recipient_lines).toBe(0);
    });

    it('skips users deleted less than 12 months ago', async () => {
      em.find.mockResolvedValueOnce([]); // no expired users found

      const result = await service.purgeExpiredRecords(
        em as unknown as EntityManager,
      );

      expect(result.purged_users).toBe(0);
      expect(em.remove).not.toHaveBeenCalled();
    });

    it('purges cancelled documents and expired recipient lines for each expired user', async () => {
      const expiredUser = {
        patient_id: EXPIRED_USER_ID,
        name: 'Usuario eliminado',
        last_name: '',
        email: null,
        phone_number: null,
        deleted_at: thirteenMonthsAgo,
      } as User;

      const cancelledDoc = {
        id: 'doc-1',
        owner_id: EXPIRED_USER_ID,
        status: DocumentStatus.CANCELLED,
      } as Document;

      const expiredRecipient = {
        id: 'rec-1',
        user_id: EXPIRED_USER_ID,
        signing_status: SigningStatus.EXPIRED,
      } as DocumentRecipient;

      em.find
        .mockResolvedValueOnce([expiredUser]) // expired users
        .mockResolvedValueOnce([cancelledDoc]) // cancelled docs
        .mockResolvedValueOnce([expiredRecipient]); // expired recipients

      const result = await service.purgeExpiredRecords(
        em as unknown as EntityManager,
      );

      expect(result.purged_users).toBe(1);
      expect(result.purged_documents).toBe(1);
      expect(result.purged_recipient_lines).toBe(1);
      expect(em.remove).toHaveBeenCalledWith(cancelledDoc);
      expect(em.remove).toHaveBeenCalledWith(expiredRecipient);
      expect(em.remove).toHaveBeenCalledWith(expiredUser);
    });

    it('does not fail when there are no records to purge', async () => {
      em.find.mockResolvedValueOnce([]);

      const result = await service.purgeExpiredRecords(
        em as unknown as EntityManager,
      );

      expect(result).toEqual({
        purged_users: 0,
        purged_documents: 0,
        purged_recipient_lines: 0,
      });
      expect(em.remove).not.toHaveBeenCalled();
    });

    it('handles multiple expired users', async () => {
      const user1 = {
        patient_id: EXPIRED_USER_ID,
        deleted_at: thirteenMonthsAgo,
      } as User;
      const user2 = {
        patient_id: RECENT_USER_ID,
        deleted_at: thirteenMonthsAgo,
      } as User;

      em.find
        .mockResolvedValueOnce([user1, user2]) // expired users
        .mockResolvedValueOnce([]) // user1 cancelled docs
        .mockResolvedValueOnce([]) // user1 expired recipients
        .mockResolvedValueOnce([]) // user2 cancelled docs
        .mockResolvedValueOnce([]); // user2 expired recipients

      const result = await service.purgeExpiredRecords(
        em as unknown as EntityManager,
      );

      expect(result.purged_users).toBe(2);
      expect(em.remove).toHaveBeenCalledTimes(2);
    });
  });
});
