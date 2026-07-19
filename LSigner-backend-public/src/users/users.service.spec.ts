import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';
import {
  DocumentSigningEvent,
  DocumentSigningEventAction,
} from '../entities/document-signing-event.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateEmailDto } from './dto/update-email.dto';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PATIENT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const OTHER_ID = 'b4cc290f-9ca0-4999-0023-bdf5f7654113';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    patient_id: PATIENT_ID,
    name: 'John',
    last_name: 'Doe',
    country: 'Spain',
    national_id: '12345678A',
    passport: 'AB123456',
    email: 'john@example.com',
    phone_number: '+34600000000',
    password: 'hashed_password',
    salt: 'original_salt',
    deleted_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

const CREATE_DTO: CreateUserDto = {
  name: 'John',
  last_name: 'Doe',
  country: 'Spain',
  national_id: '12345678A',
  passport: 'AB123456',
  email: 'john@example.com',
  phone_number: '+34600000000',
  password: 'plainpassword123',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let em: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    em = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: EntityManager, useValue: em }],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);

      await expect(
        service.findById(PATIENT_ID, em as unknown as EntityManager),
      ).resolves.toEqual(user);
      expect(em.findOne).toHaveBeenCalledWith(User, {
        where: { patient_id: PATIENT_ID },
      });
    });

    it('throws NotFoundException when not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findById(PATIENT_ID, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByEmail ─────────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);

      await expect(
        service.findByEmail('john@example.com', em as unknown as EntityManager),
      ).resolves.toEqual(user);
      expect(em.findOne).toHaveBeenCalledWith(User, {
        where: { email: 'john@example.com' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findByEmail(
          'nobody@example.com',
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByPhoneNumber ───────────────────────────────────────────────────────

  describe('findByPhoneNumber', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);

      await expect(
        service.findByPhoneNumber(
          '+34600000000',
          em as unknown as EntityManager,
        ),
      ).resolves.toEqual(user);
      expect(em.findOne).toHaveBeenCalledWith(User, {
        where: { phone_number: '+34600000000' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findByPhoneNumber(
          '+34999999999',
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByNationalId ────────────────────────────────────────────────────────

  describe('findByNationalId', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);

      await expect(
        service.findByNationalId('12345678A', em as unknown as EntityManager),
      ).resolves.toEqual(user);
      expect(em.findOne).toHaveBeenCalledWith(User, {
        where: { national_id: '12345678A' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findByNationalId('00000000X', em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByPassport ──────────────────────────────────────────────────────────

  describe('findByPassport', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);

      await expect(
        service.findByPassport('AB123456', em as unknown as EntityManager),
      ).resolves.toEqual(user);
      expect(em.findOne).toHaveBeenCalledWith(User, {
        where: { passport: 'AB123456' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findByPassport('ZZ999999', em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns the user when all fields are unique', async () => {
      em.findOne.mockResolvedValue(null); // all four uniqueness checks pass
      const saved = makeUser();
      em.create.mockReturnValueOnce(saved);
      em.save.mockResolvedValueOnce(saved);

      await expect(
        service.create(CREATE_DTO, em as unknown as EntityManager),
      ).resolves.toEqual(saved);
      expect(em.save).toHaveBeenCalledWith(saved);
    });

    it('passes hashed password (not plaintext) to entityManager.create', async () => {
      em.findOne.mockResolvedValue(null);
      em.create.mockReturnValueOnce(makeUser());
      em.save.mockResolvedValueOnce(makeUser());

      await service.create(CREATE_DTO, em as unknown as EntityManager);

      expect(em.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          password: expect.stringMatching(/^[0-9a-f]{128}$/),
          salt: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      );
    });

    it('throws ConflictException when email is already in use', async () => {
      em.findOne.mockResolvedValueOnce(makeUser()); // email conflict on first check

      await expect(
        service.create(CREATE_DTO, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
      expect(em.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when phone_number is already in use', async () => {
      em.findOne
        .mockResolvedValueOnce(null) // email ok
        .mockResolvedValueOnce(makeUser()); // phone conflict

      await expect(
        service.create(CREATE_DTO, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when national_id is already in use', async () => {
      em.findOne
        .mockResolvedValueOnce(null) // email ok
        .mockResolvedValueOnce(null) // phone ok
        .mockResolvedValueOnce(makeUser()); // national_id conflict

      await expect(
        service.create(CREATE_DTO, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when passport is already in use', async () => {
      em.findOne
        .mockResolvedValueOnce(null) // email ok
        .mockResolvedValueOnce(null) // phone ok
        .mockResolvedValueOnce(null) // national_id ok
        .mockResolvedValueOnce(makeUser()); // passport conflict

      await expect(
        service.create(CREATE_DTO, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('skips national_id uniqueness check when national_id is not provided', async () => {
      const dto = { ...CREATE_DTO, national_id: undefined };
      em.findOne.mockResolvedValue(null);
      em.create.mockReturnValueOnce(makeUser({ national_id: null }));
      em.save.mockResolvedValueOnce(makeUser({ national_id: null }));

      await service.create(dto, em as unknown as EntityManager);

      // email + phone + passport = 3 calls (national_id check is skipped)
      expect(em.findOne).toHaveBeenCalledTimes(3);
    });

    it('skips passport uniqueness check when passport is not provided', async () => {
      const dto = { ...CREATE_DTO, passport: undefined };
      em.findOne.mockResolvedValue(null);
      em.create.mockReturnValueOnce(makeUser({ passport: null }));
      em.save.mockResolvedValueOnce(makeUser({ passport: null }));

      await service.create(dto, em as unknown as EntityManager);

      // email + phone + national_id = 3 calls (passport check is skipped)
      expect(em.findOne).toHaveBeenCalledTimes(3);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the user', async () => {
      const dto: UpdateUserDto = { name: 'Jane' };
      em.findOne.mockResolvedValueOnce(makeUser());
      em.save.mockImplementationOnce((user: User) => Promise.resolve(user));

      const result = await service.update(
        PATIENT_ID,
        dto,
        em as unknown as EntityManager,
      );
      expect(result.name).toBe('Jane');
      expect(em.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(
          PATIENT_ID,
          { name: 'Jane' },
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('hashes the new password and does not store plaintext', async () => {
      const dto: UpdateUserDto = { password: 'newpassword123' };
      em.findOne.mockResolvedValueOnce(makeUser());
      em.save.mockImplementationOnce((user: User) => Promise.resolve(user));

      const result = await service.update(
        PATIENT_ID,
        dto,
        em as unknown as EntityManager,
      );
      expect(result.password).not.toBe('newpassword123');
      expect(result.password).toMatch(/^[0-9a-f]{128}$/);
      expect(result.salt).toMatch(/^[0-9a-f]{64}$/);
    });

    it('throws ConflictException when new phone_number is taken', async () => {
      const dto: UpdateUserDto = { phone_number: '+34999999999' };
      em.findOne
        .mockResolvedValueOnce(makeUser()) // findById
        .mockResolvedValueOnce(makeUser({ patient_id: OTHER_ID })); // phone conflict

      await expect(
        service.update(PATIENT_ID, dto, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('does not check phone_number uniqueness when it has not changed', async () => {
      const dto: UpdateUserDto = { phone_number: '+34600000000' }; // same as existing
      em.findOne.mockResolvedValueOnce(makeUser());
      em.save.mockImplementationOnce((user: User) => Promise.resolve(user));

      await service.update(PATIENT_ID, dto, em as unknown as EntityManager);

      // only findById -> one call, no uniqueness check for phone
      expect(em.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when new national_id is taken', async () => {
      const dto: UpdateUserDto = { national_id: '99999999Z' };
      em.findOne
        .mockResolvedValueOnce(makeUser()) // findById
        .mockResolvedValueOnce(makeUser({ patient_id: OTHER_ID })); // national_id conflict

      await expect(
        service.update(PATIENT_ID, dto, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when new passport is taken', async () => {
      const dto: UpdateUserDto = { passport: 'ZZ999999' };
      em.findOne
        .mockResolvedValueOnce(makeUser()) // findById
        .mockResolvedValueOnce(makeUser({ patient_id: OTHER_ID })); // passport conflict

      await expect(
        service.update(PATIENT_ID, dto, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── updateEmail ─────────────────────────────────────────────────────────────

  describe('updateEmail', () => {
    const dto: UpdateEmailDto = { new_email: 'new@example.com' };

    it('updates the email and returns the user', async () => {
      em.findOne
        .mockResolvedValueOnce(makeUser()) // findById
        .mockResolvedValueOnce(null); // new email is free
      em.save.mockImplementationOnce((user: User) => Promise.resolve(user));

      const result = await service.updateEmail(
        PATIENT_ID,
        dto,
        em as unknown as EntityManager,
      );
      expect(result.email).toBe('new@example.com');
    });

    it('returns the user unchanged when new_email equals the current email', async () => {
      const sameEmailDto: UpdateEmailDto = { new_email: 'john@example.com' };
      em.findOne.mockResolvedValueOnce(makeUser());

      const result = await service.updateEmail(
        PATIENT_ID,
        sameEmailDto,
        em as unknown as EntityManager,
      );
      expect(result.email).toBe('john@example.com');
      expect(em.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when new_email is already in use', async () => {
      em.findOne
        .mockResolvedValueOnce(makeUser()) // findById
        .mockResolvedValueOnce(makeUser({ patient_id: OTHER_ID })); // email conflict

      await expect(
        service.updateEmail(PATIENT_ID, dto, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateEmail(PATIENT_ID, dto, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the user', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);
      em.remove.mockResolvedValueOnce(undefined);

      await expect(
        service.remove(PATIENT_ID, em as unknown as EntityManager),
      ).resolves.toBeUndefined();
      expect(em.remove).toHaveBeenCalledWith(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(PATIENT_ID, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
      expect(em.remove).not.toHaveBeenCalled();
    });
  });

  // ── deleteMyAccount ────────────────────────────────────────────────────────

  describe('deleteMyAccount', () => {
    it('soft-deletes the user with anonimized fields', async () => {
      const user = makeUser({ phone_number: '+34600000000' });
      em.findOne.mockResolvedValueOnce(user);
      em.find
        .mockResolvedValueOnce([]) // No SENT docs (Caso A)
        .mockResolvedValueOnce([]); // No PENDING recipients (Caso B)
      em.save.mockImplementation((entity: object) => Promise.resolve(entity));

      const result = await service.deleteMyAccount(
        PATIENT_ID,
        em as unknown as EntityManager,
      );

      // Verify the user was saved with anonimized fields
      const savedUser = (em.save.mock.calls as unknown[][]).find(
        (call) => (call[0] as User).patient_id === PATIENT_ID,
      )?.[0] as User;
      expect(savedUser).toBeDefined();
      expect(savedUser.name).toBe('Usuario eliminado');
      expect(savedUser.last_name).toBe('');
      expect(savedUser.email).toMatch(/^deleted-.*@deleted\.local$/);
      expect(savedUser.phone_number).toBeNull();
      expect(savedUser.deleted_at).toBeInstanceOf(Date);

      expect(result).toEqual({
        message: 'Cuenta eliminada correctamente',
        cancelled_documents: 0,
        expired_recipient_lines: 0,
        notifications: {
          documentCancelled: [],
          recipientExpired: [],
        },
      });
    });

    it('handles Caso A: cancels SENT documents owned by the user', async () => {
      const user = makeUser();
      const doc = {
        id: 'doc-1',
        owner_id: PATIENT_ID,
        title: 'Test Document',
        status: DocumentStatus.SENT,
        recipients: [
          {
            recipient_email: 'recipient@example.com',
            recipient_name: 'Alice',
          },
        ],
      } as unknown as Document;

      em.findOne.mockResolvedValueOnce(user); // findById
      em.find
        .mockResolvedValueOnce([doc]) // SENT docs found
        .mockResolvedValueOnce([]); // No PENDING recipients

      em.save.mockImplementation((entity: object) => Promise.resolve(entity));

      const result = await service.deleteMyAccount(
        PATIENT_ID,
        em as unknown as EntityManager,
      );

      // Verify doc was saved as CANCELLED
      const savedDoc = (em.save.mock.calls as unknown[][]).find(
        (call) => (call[0] as Document).id === 'doc-1',
      )?.[0] as Document;
      expect(savedDoc).toBeDefined();
      expect(savedDoc.status).toBe(DocumentStatus.CANCELLED);

      expect(result.cancelled_documents).toBe(1);
      expect(result.notifications.documentCancelled).toHaveLength(1);
      expect(result.notifications.documentCancelled[0]).toEqual({
        recipientEmail: 'recipient@example.com',
        recipientName: 'Alice',
        senderName: 'John',
        documentTitle: 'Test Document',
      });
    });

    it('handles Caso B: expires PENDING recipient lines and creates events', async () => {
      const user = makeUser();
      const recipient = {
        id: 'rec-1',
        user_id: PATIENT_ID,
        document_id: 'doc-1',
        recipient_email: 'recipient@example.com',
        recipient_name: 'Alice',
        signing_status: SigningStatus.PENDING,
        document: {
          id: 'doc-1',
          title: 'Important Doc',
          owner_id: 'owner-1',
          owner: makeUser({
            patient_id: 'owner-1',
            email: 'owner@example.com',
          }),
        },
      } as unknown as DocumentRecipient;

      em.findOne.mockResolvedValueOnce(user); // findById
      em.find
        .mockResolvedValueOnce([]) // No SENT docs
        .mockResolvedValueOnce([recipient]); // PENDING recipient found

      em.save.mockImplementation((entity: object) => Promise.resolve(entity));
      em.create.mockImplementation((_entity: unknown, data: object) => data);

      const result = await service.deleteMyAccount(
        PATIENT_ID,
        em as unknown as EntityManager,
      );

      // Verify recipient was saved as EXPIRED
      const savedRecipient = (em.save.mock.calls as unknown[][]).find(
        (call) => (call[0] as DocumentRecipient).id === 'rec-1',
      )?.[0] as DocumentRecipient;
      expect(savedRecipient).toBeDefined();
      expect(savedRecipient.signing_status).toBe(SigningStatus.EXPIRED);

      // Verify signing event was created
      expect(em.create).toHaveBeenCalledWith(
        DocumentSigningEvent,
        expect.objectContaining({
          document_id: 'doc-1',
          recipient_id: 'rec-1',
          action: DocumentSigningEventAction.RECIPIENT_ACCOUNT_DELETED,
        }),
      );

      expect(result.expired_recipient_lines).toBe(1);
      expect(result.notifications.recipientExpired).toHaveLength(1);
      expect(result.notifications.recipientExpired[0]).toEqual({
        ownerEmail: 'owner@example.com',
        ownerName: 'John Doe',
        recipientName: 'Alice',
        documentTitle: 'Important Doc',
      });
    });

    it('does not affect non-SENT documents (already SIGNED, DRAFT, etc.)', async () => {
      const user = makeUser();
      // Only find SENT docs — DRAFT docs should not be affected
      em.findOne.mockResolvedValueOnce(user);
      em.find
        .mockResolvedValueOnce([]) // No SENT docs found
        .mockResolvedValueOnce([]); // No PENDING recipients
      em.save.mockImplementation((entity: object) => Promise.resolve(entity));

      const result = await service.deleteMyAccount(
        PATIENT_ID,
        em as unknown as EntityManager,
      );

      expect(result.cancelled_documents).toBe(0);
      expect(result.expired_recipient_lines).toBe(0);
      expect(result.notifications.documentCancelled).toHaveLength(0);
      expect(result.notifications.recipientExpired).toHaveLength(0);
    });

    it('does not affect non-PENDING recipient lines', async () => {
      const user = makeUser();
      em.findOne.mockResolvedValueOnce(user);
      em.find
        .mockResolvedValueOnce([]) // No SENT docs
        .mockResolvedValueOnce([]); // No PENDING recipients (only SIGNED/REJECTED)
      em.save.mockImplementation((entity: object) => Promise.resolve(entity));

      const result = await service.deleteMyAccount(
        PATIENT_ID,
        em as unknown as EntityManager,
      );

      expect(result.cancelled_documents).toBe(0);
      expect(result.expired_recipient_lines).toBe(0);
      expect(result.notifications.documentCancelled).toHaveLength(0);
      expect(result.notifications.recipientExpired).toHaveLength(0);
    });

    it('throws NotFoundException when user does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteMyAccount(PATIENT_ID, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
