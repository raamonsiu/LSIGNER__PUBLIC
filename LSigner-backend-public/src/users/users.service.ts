import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, ILike, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { promisify } from 'util';
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
import { UserSearchResultDto } from './dto/user-search-result.dto';
import {
  normalizeEmail,
  normalizePhone,
  normalizeDocumentId,
} from '../common/utils/normalize';

@Injectable()
export class UsersService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) { }

  // d==============================================
  // Helpers
  // d==============================================

  private readonly scrypt = promisify(crypto.scrypt);

  /**
   * Hashes a plaintext password with scrypt (async) so the event loop is not
   * blocked during CPU-intensive key derivation under load.
   */
  private async hashPassword(
    plain: string,
  ): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(32).toString('hex');
    const derivedKey = await this.scrypt(plain, salt, 64);
    const hash = (derivedKey as Buffer).toString('hex');
    return { hash, salt };
  }

  // d==============================================
  // Queries
  // All methods accept an optional transactionalEntityManager. When the
  // controller (or any other caller) has already opened a transaction, it
  // passes its transactionalEntityManager so every operation shares the same
  // unit of work. Without it the service falls back to its own entityManager.
  // d==============================================

  /**
   * Returns the user with the given patient UUID.
   * @param patient_id Patient UUID to look up
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async findById(
    patient_id: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await entityManager.findOne(User, { where: { patient_id } });
    if (!user)
      throw new NotFoundException(`User with ID ${patient_id} not found`);
    return user;
  }

  /**
   * Returns the user with the given canonical email address.
   * @param email Canonical (lowercased) email address
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async findByEmail(
    email: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await entityManager.findOne(User, { where: { email } });
    if (!user)
      throw new NotFoundException(`User with email ${email} not found`);
    return user;
  }

  /**
   * Returns the user with the given E.164 phone number.
   * @param phone_number Phone number in E.164 format
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async findByPhoneNumber(
    phone_number: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await entityManager.findOne(User, { where: { phone_number } });
    if (!user)
      throw new NotFoundException(
        `User with phone number ${phone_number} not found`,
      );
    return user;
  }

  /**
   * Returns the user with the given national identity document number (uppercase).
   * @param national_id Normalised national ID (uppercase, trimmed)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async findByNationalId(
    national_id: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await entityManager.findOne(User, { where: { national_id } });
    if (!user)
      throw new NotFoundException(
        `User with national ID ${national_id} not found`,
      );
    return user;
  }

  /**
   * Returns the user with the given passport number (uppercase).
   * @param passport Normalised passport number (uppercase, trimmed)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async findByPassport(
    passport: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await entityManager.findOne(User, { where: { passport } });
    if (!user)
      throw new NotFoundException(`User with passport ${passport} not found`);
    return user;
  }

  /**
   * Searches registered users by a free-text query that performs a
   * case-insensitive partial match on name, last_name, and email.
   *
   * Only the four safe fields are returned — sensitive data (phone, national_id,
   * passport, password) is explicitly excluded via select projection.
   *
   * Results are capped at 20 to prevent unbounded response payloads.
   *
   * @param query Free-text search string
   * @param transactionalEntityManager EntityManager from the caller's transaction
   * @returns Up to 20 matching users with only safe fields populated
   */
  async search(
    query: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<UserSearchResultDto[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    if (!query || query.trim().length === 0) {
      return [];
    }

    const pattern = `%${query.trim()}%`;

    const users = await entityManager.find(User, {
      where: [
        { name: ILike(pattern), deleted_at: IsNull() },
        { last_name: ILike(pattern), deleted_at: IsNull() },
        { email: ILike(pattern), deleted_at: IsNull() },
      ],
      select: ['patient_id', 'name', 'last_name', 'email'],
      take: 20,
    });

    return users.map((user) => ({
      id: user.patient_id,
      name: user.name,
      last_name: user.last_name,
      email: user.email,
    }));
  }

  // d==============================================
  // Mutations
  // d==============================================

  /**
   * Creates a new user after validating uniqueness of email, phone, national ID and passport.
   * All fields are canonicalised before persistence.
   * @param dto User creation payload
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async create(
    dto: CreateUserDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Canonicalise fields to the same format the lookup pipes produce so
    // storage and query formats are always identical.
    const canonicalEmail = normalizeEmail(dto.email);
    const canonicalPhone = normalizePhone(dto.phone_number);
    const canonicalNationalId = dto.national_id
      ? normalizeDocumentId(dto.national_id)
      : null;
    const canonicalPassport = dto.passport
      ? normalizeDocumentId(dto.passport)
      : null;

    // Full uniqueness checks before attempting any insert
    if (
      await entityManager.findOne(User, { where: { email: canonicalEmail } })
    ) {
      throw new ConflictException(`Email ${canonicalEmail} is already in use`);
    }
    if (
      await entityManager.findOne(User, {
        where: { phone_number: canonicalPhone },
      })
    ) {
      throw new ConflictException(
        `Phone number ${canonicalPhone} is already in use`,
      );
    }
    if (
      canonicalNationalId &&
      (await entityManager.findOne(User, {
        where: { national_id: canonicalNationalId },
      }))
    ) {
      throw new ConflictException(
        `National ID ${canonicalNationalId} is already in use`,
      );
    }
    if (
      canonicalPassport &&
      (await entityManager.findOne(User, {
        where: { passport: canonicalPassport },
      }))
    ) {
      throw new ConflictException(
        `Passport ${canonicalPassport} is already in use`,
      );
    }

    const { hash, salt } = await this.hashPassword(dto.password);

    const user = entityManager.create(User, {
      name: dto.name,
      last_name: dto.last_name,
      country: dto.country,
      national_id: canonicalNationalId,
      passport: canonicalPassport,
      email: canonicalEmail,
      phone_number: canonicalPhone,
      password: hash,
      salt,
    });

    return entityManager.save(user);
  }

  /**
   * Updates one or more profile fields for the given user.
   * Only changed unique fields (phone, national ID, passport) are checked for conflicts.
   * @param patient_id Patient UUID of the user to update
   * @param dto Fields to update (partial)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async update(
    patient_id: string,
    dto: UpdateUserDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await this.findById(patient_id, entityManager);

    // Canonicalise fields to the same format the lookup pipes produce.
    const canonicalPhone = dto.phone_number
      ? normalizePhone(dto.phone_number)
      : undefined;
    const canonicalNationalId = dto.national_id
      ? normalizeDocumentId(dto.national_id)
      : undefined;
    const canonicalPassport = dto.passport
      ? normalizeDocumentId(dto.passport)
      : undefined;

    // Only check uniqueness for fields that actually changed
    if (canonicalPhone && canonicalPhone !== user.phone_number) {
      if (
        await entityManager.findOne(User, {
          where: { phone_number: canonicalPhone },
        })
      ) {
        throw new ConflictException(
          `Phone number ${canonicalPhone} is already in use`,
        );
      }
    }
    if (canonicalNationalId && canonicalNationalId !== user.national_id) {
      if (
        await entityManager.findOne(User, {
          where: { national_id: canonicalNationalId },
        })
      ) {
        throw new ConflictException(
          `National ID ${canonicalNationalId} is already in use`,
        );
      }
    }
    if (canonicalPassport && canonicalPassport !== user.passport) {
      if (
        await entityManager.findOne(User, {
          where: { passport: canonicalPassport },
        })
      ) {
        throw new ConflictException(
          `Passport ${canonicalPassport} is already in use`,
        );
      }
    }

    if (dto.password) {
      const { hash, salt } = await this.hashPassword(dto.password);
      user.password = hash;
      user.salt = salt;
    }

    // Spread the DTO then override with canonicalised values.
    const { password: _pw, ...rest } = dto;
    Object.assign(user, rest, {
      ...(canonicalPhone !== undefined && { phone_number: canonicalPhone }),
      ...(canonicalNationalId !== undefined && {
        national_id: canonicalNationalId,
      }),
      ...(canonicalPassport !== undefined && { passport: canonicalPassport }),
    });

    return entityManager.save(user);
  }

  /**
   * Updates the authenticated user's profile, optionally including an email change.
   * Handles both email update and profile field update in a single transaction.
   */
  async updateProfile(
    patient_id: string,
    dto: UpdateUserDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const { email, ...persistDto } = dto;

    if (email) {
      await this.updateEmail(patient_id, { new_email: email }, entityManager);
    }

    return this.update(patient_id, persistDto, entityManager);
  }

  /**
   * Update a user's email address.
   * Email is a unique natural key, so it has its own dedicated endpoint.
   * Any future tables that reference users by email must also be updated
   * inside this same transaction.
   */
  async updateEmail(
    patient_id: string,
    dto: UpdateEmailDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<User> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await this.findById(patient_id, entityManager);

    const canonicalNewEmail = normalizeEmail(dto.new_email);

    if (canonicalNewEmail === user.email) {
      return user;
    }

    if (
      await entityManager.findOne(User, { where: { email: canonicalNewEmail } })
    ) {
      throw new ConflictException(
        `Email ${canonicalNewEmail} is already in use`,
      );
    }

    // Extend here when other tables reference users by email
    user.email = canonicalNewEmail;
    return entityManager.save(user);
  }

  /**
   * Permanently deletes the user with the given patient UUID.
   * @param patient_id Patient UUID of the user to delete
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async remove(
    patient_id: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const user = await this.findById(patient_id, entityManager);
    await entityManager.remove(user);
  }

  // d==============================================──────────────────────────────────
  // Soft-delete (account deletion with cascade)
  // d==============================================──────────────────────────────────

  /**
   * Soft-deletes the authenticated user's account inside a transaction:
   * 1. Anonimizes user personal data (name, email, phone)
   * 2. Caso A: marks all SENT documents as CANCELLED
   * 3. Caso B: marks all PENDING signature lines as EXPIRED + creates events
   *
   * @param patient_id Patient UUID of the user to soft-delete
   * @param transactionalEntityManager EntityManager passed from the controller's transaction
   */
  async deleteMyAccount(
    patient_id: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<{
    message: string;
    cancelled_documents: number;
    expired_recipient_lines: number;
    notifications: {
      documentCancelled: Array<{
        recipientEmail: string;
        recipientName: string | null;
        senderName: string;
        documentTitle: string;
      }>;
      recipientExpired: Array<{
        ownerEmail: string;
        ownerName: string;
        recipientName: string | null;
        documentTitle: string;
      }>;
    };
  }> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // 1. Find the user and capture pre-anonimization data
    const user = await this.findById(patient_id, entityManager);
    const preDeleteName = user.name;

    // 2. Caso A: cancel SENT documents where user is the sender
    // Do this BEFORE anonimization so we can reference the user's name for notifications
    const sentDocuments = await entityManager.find(Document, {
      where: { owner_id: patient_id, status: DocumentStatus.SENT },
      relations: ['recipients'],
    });

    const documentCancelledNotifications: Array<{
      recipientEmail: string;
      recipientName: string | null;
      senderName: string;
      documentTitle: string;
    }> = [];

    for (const doc of sentDocuments) {
      doc.status = DocumentStatus.CANCELLED;
      await entityManager.save(doc);

      // Collect notification data for each pending recipient
      for (const recipient of doc.recipients ?? []) {
        documentCancelledNotifications.push({
          recipientEmail: recipient.recipient_email,
          recipientName: recipient.recipient_name,
          senderName: preDeleteName,
          documentTitle: doc.title,
        });
      }
    }

    // 3. Anonimize the user
    user.name = 'Usuario eliminado';
    user.last_name = '';
    user.email = `deleted-${patient_id}@deleted.local`;
    user.phone_number = null;
    user.deleted_at = new Date();
    await entityManager.save(user);

    // 3. Caso B: expire PENDING recipient lines where user is the recipient
    const pendingRecipients = await entityManager.find(DocumentRecipient, {
      where: {
        user_id: patient_id,
        signing_status: SigningStatus.PENDING,
      },
      relations: ['document', 'document.owner'],
    });

    const recipientExpiredNotifications: Array<{
      ownerEmail: string;
      ownerName: string;
      recipientName: string | null;
      documentTitle: string;
    }> = [];

    for (const recipient of pendingRecipients) {
      recipient.signing_status = SigningStatus.EXPIRED;
      await entityManager.save(recipient);

      const event = entityManager.create(DocumentSigningEvent, {
        document_id: recipient.document_id,
        recipient_id: recipient.id,
        action: DocumentSigningEventAction.RECIPIENT_ACCOUNT_DELETED,
        metadata: {},
        occurred_at: new Date(),
      });
      await entityManager.save(event);

      // Collect notification data for the document owner
      if (recipient.document?.owner) {
        recipientExpiredNotifications.push({
          ownerEmail: recipient.document.owner.email,
          ownerName: `${recipient.document.owner.name} ${recipient.document.owner.last_name}`,
          recipientName: recipient.recipient_name,
          documentTitle: recipient.document.title,
        });
      }
    }

    return {
      message: 'Cuenta eliminada correctamente',
      cancelled_documents: sentDocuments.length,
      expired_recipient_lines: pendingRecipients.length,
      // Notification data for email dispatch after transaction commit
      notifications: {
        documentCancelled: documentCancelledNotifications,
        recipientExpired: recipientExpiredNotifications,
      },
    };
  }
}
