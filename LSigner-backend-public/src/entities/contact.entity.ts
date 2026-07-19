import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A saved recipient contact for a user (unidirectional: owner -> contact_user).
 *
 * Contacts are independent from documents : deleting a contact does not affect
 * past document deliveries and deleting a document does not remove contacts.
 *
 * - "contact_user_id" is set when the saved contact is a registered user.
 * - When the referenced user is deleted, "contact_user_id" is set to NULL
 *   without removing the contact row (allows keeping the email/name/phone).
 */
@Entity({ name: 'contacts' })
@Unique(['owner_id', 'contact_email'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'uuid', nullable: true, default: null })
  @Index()
  contact_user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contact_user_id' })
  contact_user: User | null;

  @Column({ length: 255 })
  contact_email: string;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  contact_name: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, default: null })
  contact_phone: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
