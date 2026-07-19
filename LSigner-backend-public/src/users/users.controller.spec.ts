import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { EmailService } from '../email/email.service';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PATIENT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;
  let emailService: {
    sendWelcomeEmail: jest.Mock;
    sendAccountDeleted: jest.Mock;
  };

  // The transactionalEntityManager that the mock passes into the callback
  const mockTransactionalEntityManager = {} as EntityManager;
  let mockEntityManager: { transaction: jest.Mock };

  beforeEach(async () => {
    // Recreate the entityManager mock each test so call counts are isolated
    mockEntityManager = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: EntityManager) => Promise<unknown>) =>
          cb(mockTransactionalEntityManager),
        ),
    };

    const mockUsersService: Partial<jest.Mocked<UsersService>> = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateEmail: jest.fn(),
      remove: jest.fn(),
      deleteMyAccount: jest.fn(),
    };

    emailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountDeleted: jest.fn().mockResolvedValue(undefined),
      sendDocumentCancelled: jest.fn().mockResolvedValue(undefined),
      sendRecipientExpired: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: EmailService, useValue: emailService },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    controller = module.get(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── GET /me ──────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('opens a transaction and delegates to service.findById with the token subject', async () => {
      const user = makeUser();
      const currentUser: JwtPayload = {
        sub: PATIENT_ID,
        email: 'john@example.com',
      };
      usersService.findById.mockResolvedValueOnce(user);

      const result = await controller.getMe(currentUser);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.findById).toHaveBeenCalledWith(
        PATIENT_ID,
        mockTransactionalEntityManager,
      );
      expect(result).toEqual(user);
    });
  });

  // ── POST / ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('opens a transaction, delegates to service.create, and fires welcome email', async () => {
      const dto: CreateUserDto = {
        name: 'John',
        last_name: 'Doe',
        country: 'Spain',
        email: 'john@example.com',
        phone_number: '+34600000000',
        password: 'plainpassword123',
      };
      const user = makeUser();
      usersService.create.mockResolvedValueOnce(user);

      const result = await controller.create(dto);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.create).toHaveBeenCalledWith(
        dto,
        mockTransactionalEntityManager,
      );
      expect(result).toEqual(user);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        'john@example.com',
        {
          username: 'John',
        },
      );
    });
  });

  // ── PATCH :id ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('opens a transaction and delegates to service.update', async () => {
      const dto: UpdateUserDto = { name: 'Jane' };
      const user = makeUser({ name: 'Jane' });
      usersService.update.mockResolvedValueOnce(user);

      const result = await controller.update(PATIENT_ID, dto);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.update).toHaveBeenCalledWith(
        PATIENT_ID,
        dto,
        mockTransactionalEntityManager,
      );
      expect(result).toEqual(user);
    });
  });

  // ── PATCH :id/email ─────────────────────────────────────────────────────────

  describe('updateEmail', () => {
    it('opens a transaction and delegates to service.updateEmail', async () => {
      const dto: UpdateEmailDto = { new_email: 'new@example.com' };
      const user = makeUser({ email: 'new@example.com' });
      usersService.updateEmail.mockResolvedValueOnce(user);

      const result = await controller.updateEmail(PATIENT_ID, dto);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.updateEmail).toHaveBeenCalledWith(
        PATIENT_ID,
        dto,
        mockTransactionalEntityManager,
      );
      expect(result).toEqual(user);
    });
  });

  // ── DELETE /me/delete ─────────────────────────────────────────────────────

  describe('deleteMyAccount', () => {
    it('opens a transaction, delegates to service, and fires notification emails', async () => {
      const currentUser: JwtPayload = {
        sub: PATIENT_ID,
        email: 'john@example.com',
      };
      usersService.deleteMyAccount.mockResolvedValueOnce({
        message: 'Cuenta eliminada correctamente',
        cancelled_documents: 2,
        expired_recipient_lines: 1,
        notifications: {
          documentCancelled: [
            {
              recipientEmail: 'recipient@example.com',
              recipientName: 'Alice',
              senderName: 'John',
              documentTitle: 'Contract',
            },
          ],
          recipientExpired: [
            {
              ownerEmail: 'owner@example.com',
              ownerName: 'Bob Smith',
              recipientName: 'Alice',
              documentTitle: 'NDA',
            },
          ],
        },
      });

      const result = await controller.deleteMyAccount(currentUser);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.deleteMyAccount).toHaveBeenCalledWith(
        PATIENT_ID,
        mockTransactionalEntityManager,
      );

      // Verify notification emails were dispatched
      expect(emailService.sendDocumentCancelled).toHaveBeenCalledWith(
        'recipient@example.com',
        {
          recipientName: 'Alice',
          senderName: 'John',
          documentName: 'Contract',
        },
      );
      expect(emailService.sendRecipientExpired).toHaveBeenCalledWith(
        'owner@example.com',
        {
          ownerName: 'Bob Smith',
          recipientName: 'Alice',
          documentName: 'NDA',
        },
      );

      expect(result).toEqual({
        message: 'Cuenta eliminada correctamente',
        cancelled_documents: 2,
        expired_recipient_lines: 1,
      });
    });

    it('does not fire notification emails when there are no cascading effects', async () => {
      const currentUser: JwtPayload = {
        sub: PATIENT_ID,
        email: 'john@example.com',
      };
      usersService.deleteMyAccount.mockResolvedValueOnce({
        message: 'Cuenta eliminada correctamente',
        cancelled_documents: 0,
        expired_recipient_lines: 0,
        notifications: {
          documentCancelled: [],
          recipientExpired: [],
        },
      });

      await controller.deleteMyAccount(currentUser);

      expect(emailService.sendDocumentCancelled).not.toHaveBeenCalled();
      expect(emailService.sendRecipientExpired).not.toHaveBeenCalled();
    });
  });

  // ── DELETE :id ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('opens a transaction, delegates to service, and fires account deleted email', async () => {
      const user = makeUser();
      usersService.findById.mockResolvedValueOnce(user);
      usersService.remove.mockResolvedValueOnce(undefined);

      await controller.remove(PATIENT_ID);

      expect(mockEntityManager.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.findById).toHaveBeenCalledWith(
        PATIENT_ID,
        mockTransactionalEntityManager,
      );
      expect(usersService.remove).toHaveBeenCalledWith(
        PATIENT_ID,
        mockTransactionalEntityManager,
      );
      expect(emailService.sendAccountDeleted).toHaveBeenCalledWith(
        'john@example.com',
        'John Doe',
      );
    });
  });
});
