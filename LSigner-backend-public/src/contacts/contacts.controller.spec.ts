import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { Contact } from '../entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const OWNER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const CONTACT_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';

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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContactsController', () => {
  let controller: ContactsController;
  let contactsService: jest.Mocked<ContactsService>;

  const mockTransactionalEntityManager = {} as EntityManager;
  let mockEntityManager: { transaction: jest.Mock };

  beforeEach(async () => {
    mockEntityManager = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: EntityManager) => Promise<unknown>) =>
          cb(mockTransactionalEntityManager),
        ),
    };

    const mockContactsService: Partial<jest.Mocked<ContactsService>> = {
      findAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        { provide: ContactsService, useValue: mockContactsService },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    controller = module.get(ContactsController);
    contactsService = module.get(ContactsService);
  });

  afterEach(() => jest.clearAllMocks());

  const currentUser: JwtPayload = {
    sub: OWNER_ID,
    email: 'john@example.com',
  };

  // ── GET /contacts ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('opens a transaction and delegates to service.findAll with the token subject', async () => {
      const contacts = [makeContact()];
      contactsService.findAll.mockResolvedValueOnce(contacts);

      const result = await controller.findAll(currentUser);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(contactsService.findAll).toHaveBeenCalledWith(
        OWNER_ID,
        undefined,
        mockTransactionalEntityManager,
      );
      expect(result).toEqual(contacts);
    });

    it('passes the query string to the service', async () => {
      const contacts = [makeContact()];
      contactsService.findAll.mockResolvedValueOnce(contacts);

      await controller.findAll(currentUser, 'alice');

      expect(contactsService.findAll).toHaveBeenCalledWith(
        OWNER_ID,
        'alice',
        mockTransactionalEntityManager,
      );
    });
  });

  // ── POST /contacts ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('opens a transaction and delegates to service.create', async () => {
      const dto: CreateContactDto = {
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      };
      const contact = makeContact();
      contactsService.create.mockResolvedValueOnce(contact);

      const result = await controller.create(dto, currentUser);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(contactsService.create).toHaveBeenCalledWith(
        OWNER_ID,
        dto,
        mockTransactionalEntityManager,
      );
      expect(result).toEqual(contact);
    });
  });

  // ── DELETE /contacts/:id ───────────────────────────────────────────────────

  describe('delete', () => {
    it('opens a transaction and delegates to service.delete', async () => {
      contactsService.delete.mockResolvedValueOnce(undefined);

      await controller.delete(CONTACT_ID, currentUser);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(contactsService.delete).toHaveBeenCalledWith(
        OWNER_ID,
        CONTACT_ID,
        mockTransactionalEntityManager,
      );
    });
  });
});
