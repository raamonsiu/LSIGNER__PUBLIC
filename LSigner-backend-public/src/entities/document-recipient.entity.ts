import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from './user.entity';
import { DocumentSigningEvent } from './document-signing-event.entity';
import { DocumentSignedArtifact } from './document-signed-artifact.entity';

/**
 * Tracks the delivery status of a document for a specific recipient.
 *
 * - If the recipient is a registered user, "user_id" is populated.
 * - If the recipient is external (not registered), only "recipient_email"
 *   and optionally "recipient_name" are set — "user_id" remains NULL.
 *
 * Future states (VIEWED, SIGNED, DECLINED) will be added when the
 * document-protection / signing module is implemented.
 */
export enum RecipientStatus {
  PENDING = 'PENDING',
  UPDATED = 'UPDATED',
}

/**
 * Signature workflow status for a recipient.
 *
 * - PENDING  – recipient can still sign or reject.
 * - SIGNED   – signature completed and evidence stored.
 * - REJECTED – recipient explicitly rejected signing.
 * - REVOKED  – owner revoked recipient access before signing.
 * - EXPIRED  – recipient account was deleted; signature line voided.
 */
export enum SigningStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'document_recipients' })
@Unique(['document_id', 'recipient_email'])
export class DocumentRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  document_id: string;

  @ManyToOne(() => Document, (document) => document.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ type: 'uuid', nullable: true, default: null })
  @Index()
  user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ length: 255 })
  recipient_email: string;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  recipient_name: string | null;

  /**
   * Opaque identifier used in public links for unregistered recipients.
   * Registered recipients do not receive public links.
   */
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  public_link_id: string | null;

  @Column({
    type: 'enum',
    enum: RecipientStatus,
    enumName: 'recipient_status_enum',
    default: RecipientStatus.PENDING,
  })
  status: RecipientStatus;

  @Column({ type: 'timestamptz' })
  sent_at: Date;

  /** Timestamp of the first successful access to the shared link. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  first_accessed_at: Date | null;

  /** Timestamp of the latest successful access to the shared link. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  last_accessed_at: Date | null;

  @Column({
    type: 'enum',
    enum: SigningStatus,
    enumName: 'recipient_signing_status_enum',
    default: SigningStatus.PENDING,
  })
  @Index()
  signing_status: SigningStatus;

  /** Timestamp at which the recipient signed the document. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  signed_at: Date | null;

  @OneToMany(() => DocumentSigningEvent, (event) => event.recipient)
  signing_events: DocumentSigningEvent[];

  @OneToOne(() => DocumentSignedArtifact, (artifact) => artifact.recipient)
  signed_artifact: DocumentSignedArtifact | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
