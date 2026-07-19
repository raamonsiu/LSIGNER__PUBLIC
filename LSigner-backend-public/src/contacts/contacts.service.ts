import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, ILike } from 'typeorm';
import { Contact } from '../entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { normalizeEmail } from '../common/utils/normalize';

@Injectable()
export class ContactsService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  /**
   * Returns all contacts owned by the given user, optionally filtered by a
   * search query that performs a case-insensitive match on email, name, and
   * phone. Results are ordered by contact_name ASC, then contact_email ASC,
   * then contact_phone ASC (PostgreSQL puts NULLs last by default for ASC).
   *
   * @param ownerId UUID of the contact owner (JWT sub)
   * @param query   Optional free-text search string
   * @param transactionalEntityManager EntityManager from the caller's transaction
   */
  async findAll(
    ownerId: string,
    query?: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Contact[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const order = {
      contact_name: 'ASC' as const,
      contact_email: 'ASC' as const,
      contact_phone: 'ASC' as const,
    };

    if (!query) {
      return entityManager.find(Contact, {
        where: { owner_id: ownerId },
        order,
      });
    }

    const pattern = `%${query}%`;
    return entityManager.find(Contact, {
      where: [
        { owner_id: ownerId, contact_email: ILike(pattern) },
        { owner_id: ownerId, contact_name: ILike(pattern) },
        { owner_id: ownerId, contact_phone: ILike(pattern) },
      ],
      order,
    });
  }

  /**
   * Creates a new contact for the given owner. The contact email is normalised
   * to lowercase and trimmed before storage. A duplicate check ensures the
   * same owner cannot have two contacts with the same email.
   *
   * @param ownerId UUID of the contact owner (JWT sub)
   * @param dto     Contact creation payload
   * @param transactionalEntityManager EntityManager from the caller's transaction
   */
  async create(
    ownerId: string,
    dto: CreateContactDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<Contact> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const canonicalEmail = normalizeEmail(dto.contact_email);

    const existing = await entityManager.findOne(Contact, {
      where: { owner_id: ownerId, contact_email: canonicalEmail },
    });
    if (existing) {
      throw new ConflictException(
        `Contact with email "${canonicalEmail}" already exists`,
      );
    }

    const contact = entityManager.create(Contact, {
      owner_id: ownerId,
      contact_email: canonicalEmail,
      contact_name: dto.contact_name ?? null,
      contact_phone: dto.contact_phone ?? null,
      contact_user_id: dto.contact_user_id ?? null,
    });

    return entityManager.save(contact);
  }

  /**
   * Deletes a contact by ID, verifying that the contact exists and belongs to
   * the given owner. Throws NotFoundException if the contact is not found or
   * not owned by the caller.
   *
   * @param ownerId   UUID of the requesting user (JWT sub)
   * @param contactId UUID of the contact to delete
   * @param transactionalEntityManager EntityManager from the caller's transaction
   */
  async delete(
    ownerId: string,
    contactId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const contact = await entityManager.findOne(Contact, {
      where: { id: contactId },
    });

    if (!contact || contact.owner_id !== ownerId) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    await entityManager.remove(contact);
  }
}
