import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { ContactsService } from './contacts.service';
import { Contact } from '../entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const OWNER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const CONTACT_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';
const OTHER_OWNER_ID = 'b4cc290f-9ca0-4999-0023-bdf5f7654113';

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: CONTACT_ID,
    owner_id: OWNER_ID,
    contact_user_id: null,
    contact_email: 'alice@example.com',
    contact_name: 'Alice Example',
    contact_phone: '+34600000001',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    owner: null as any,
    contact_user: null,
    ...overrides,
  };
}

const CREATE_DTO: CreateContactDto = {
  contact_email: 'alice@example.com',
  contact_name: 'Alice Example',
  contact_phone: '+34600000001',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContactsService', () => {
  let service: ContactsService;
  let em: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    em = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: EntityManager, useValue: em }],
    }).compile();

    service = module.get(ContactsService);
  });

  afterEach(() => jest.clearAllMocks());

  const EXPECTED_ORDER = {
    contact_name: 'ASC',
    contact_email: 'ASC',
    contact_phone: 'ASC',
  };

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all contacts for the owner ordered by name, email, phone ascending', async () => {
      const contacts = [
        makeContact(),
        makeContact({ id: 'r2', contact_email: 'bob@example.com' }),
      ];
      em.find.mockResolvedValueOnce(contacts);

      const result = await service.findAll(
        OWNER_ID,
        undefined,
        em as unknown as EntityManager,
      );

      expect(result).toEqual(contacts);
      expect(em.find).toHaveBeenCalledWith(Contact, {
        where: { owner_id: OWNER_ID },
        order: EXPECTED_ORDER,
      });
    });

    it('filters by query string using ILIKE on email, name, and phone', async () => {
      const contacts = [makeContact()];
      em.find.mockResolvedValueOnce(contacts);

      const result = await service.findAll(
        OWNER_ID,
        'alice',
        em as unknown as EntityManager,
      );

      expect(result).toEqual(contacts);
      expect(em.find).toHaveBeenCalledWith(Contact, {
        where: expect.arrayContaining([
          expect.objectContaining({ owner_id: OWNER_ID }),
          expect.objectContaining({ owner_id: OWNER_ID }),
          expect.objectContaining({ owner_id: OWNER_ID }),
        ]),
        order: EXPECTED_ORDER,
      });
    });

    it('returns empty array when owner has no contacts', async () => {
      em.find.mockResolvedValueOnce([]);

      const result = await service.findAll(
        OWNER_ID,
        undefined,
        em as unknown as EntityManager,
      );

      expect(result).toEqual([]);
    });

    it('falls back to default EntityManager when transactionalEntityManager is not provided', async () => {
      const contacts = [makeContact()];
      em.find.mockResolvedValueOnce(contacts);

      await service.findAll(OWNER_ID);

      expect(em.find).toHaveBeenCalledWith(Contact, {
        where: { owner_id: OWNER_ID },
        order: EXPECTED_ORDER,
      });
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns the contact when no duplicate exists', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const contact = makeContact();
      em.create.mockReturnValueOnce(contact);
      em.save.mockResolvedValueOnce(contact);

      const result = await service.create(
        OWNER_ID,
        CREATE_DTO,
        em as unknown as EntityManager,
      );

      expect(result).toEqual(contact);
      expect(em.findOne).toHaveBeenCalledWith(Contact, {
        where: {
          owner_id: OWNER_ID,
          contact_email: 'alice@example.com',
        },
      });
      expect(em.save).toHaveBeenCalledWith(contact);
    });

    it('normalises the email to lowercase and trimmed', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const contact = makeContact({ contact_email: 'ALICE@EXAMPLE.COM  ' });
      em.create.mockReturnValueOnce(contact);
      em.save.mockResolvedValueOnce(contact);

      await service.create(
        OWNER_ID,
        { contact_email: '  ALICE@Example.com  ' },
        em as unknown as EntityManager,
      );

      expect(em.create).toHaveBeenCalledWith(
        Contact,
        expect.objectContaining({
          owner_id: OWNER_ID,
          contact_email: 'alice@example.com',
        }),
      );
    });

    it('throws ConflictException when the contact already exists for the owner', async () => {
      em.findOne.mockResolvedValueOnce(makeContact());

      await expect(
        service.create(OWNER_ID, CREATE_DTO, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);

      expect(em.save).not.toHaveBeenCalled();
    });

    it('allows the same email for different owners', async () => {
      em.findOne.mockResolvedValueOnce(null); // no conflict — owner is different
      const contact = makeContact({ owner_id: OTHER_OWNER_ID });
      em.create.mockReturnValueOnce(contact);
      em.save.mockResolvedValueOnce(contact);

      const result = await service.create(
        OTHER_OWNER_ID,
        CREATE_DTO,
        em as unknown as EntityManager,
      );

      expect(result.owner_id).toBe(OTHER_OWNER_ID);
      expect(em.findOne).toHaveBeenCalledWith(Contact, {
        where: {
          owner_id: OTHER_OWNER_ID,
          contact_email: 'alice@example.com',
        },
      });
    });

    it('creates contact with contact_user_id set', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const contact = makeContact({ contact_user_id: OTHER_OWNER_ID });
      em.create.mockReturnValueOnce(contact);
      em.save.mockResolvedValueOnce(contact);

      const result = await service.create(
        OWNER_ID,
        { ...CREATE_DTO, contact_user_id: OTHER_OWNER_ID },
        em as unknown as EntityManager,
      );

      expect(result.contact_user_id).toBe(OTHER_OWNER_ID);
    });

    it('creates contact with only required fields', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const contact = makeContact({
        contact_name: null,
        contact_phone: null,
      });
      em.create.mockReturnValueOnce(contact);
      em.save.mockResolvedValueOnce(contact);

      const result = await service.create(
        OWNER_ID,
        { contact_email: 'minimal@example.com' },
        em as unknown as EntityManager,
      );

      expect(result.contact_name).toBeNull();
      expect(result.contact_phone).toBeNull();
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes the contact when found and owned by the user', async () => {
      const contact = makeContact();
      em.findOne.mockResolvedValueOnce(contact);
      em.remove.mockResolvedValueOnce(undefined);

      await expect(
        service.delete(OWNER_ID, CONTACT_ID, em as unknown as EntityManager),
      ).resolves.toBeUndefined();

      expect(em.findOne).toHaveBeenCalledWith(Contact, {
        where: { id: CONTACT_ID },
      });
      expect(em.remove).toHaveBeenCalledWith(contact);
    });

    it('throws NotFoundException when contact does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.delete(
          OWNER_ID,
          'non-existent-id',
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(em.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when contact is owned by a different user', async () => {
      const contact = makeContact({ owner_id: OTHER_OWNER_ID });
      em.findOne.mockResolvedValueOnce(contact);

      await expect(
        service.delete(OWNER_ID, CONTACT_ID, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);

      expect(em.remove).not.toHaveBeenCalled();
    });

    it('falls back to default EntityManager when transactionalEntityManager is not provided', async () => {
      const contact = makeContact();
      em.findOne.mockResolvedValueOnce(contact);
      em.remove.mockResolvedValueOnce(undefined);

      await service.delete(OWNER_ID, CONTACT_ID);

      expect(em.findOne).toHaveBeenCalledWith(Contact, {
        where: { id: CONTACT_ID },
      });
    });
  });
});
