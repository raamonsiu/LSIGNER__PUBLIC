import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DocumentRecipient } from './document-recipient.entity';
import { DocumentLock } from './document-lock.entity';

/**
 * Allowed lifecycle states for a document.
 *
 * - DRAFT      – uploaded but not yet sent to any recipient.
 * - SENT       – dispatched to at least one recipient; immutable from here.
 * - SUPERSEDED – replaced by a newer version (see "parent_document_id").
 * - VOIDED     – soft-deleted after having been sent.
 * - CANCELLED  – sender account was deleted; all pending signatures voided.
 * - DELETED    – hard-deleted record (purged by retention cron).
 */
export enum DocumentStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  SUPERSEDED = 'SUPERSEDED',
  VOIDED = 'VOIDED',
  CANCELLED = 'CANCELLED',
  DELETED = 'DELETED',
}

/**
 * A document uploaded by a user for signature.
 *
 * The binary payload ("file") is stored in the database as "bytea" with
 * "select: false" so it is never loaded unless explicitly requested (e.g.
 * on the download endpoint). Integrity is guaranteed by the SHA-256 hash
 * stored alongside the payload.
 */
@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  /** Binary payload — only loaded on explicit download queries. */
  @Column({ type: 'bytea', select: false })
  file: Buffer;

  /** SHA-256 hex digest of the binary payload (64 hex chars). */
  @Column({ length: 64 })
  file_hash: string;

  @Column({ length: 255 })
  original_filename: string;

  @Column({ length: 100 })
  mime_type: string;

  /** File size in bytes. Stored as bigint to support files > 2 GB safely. */
  @Column({ type: 'bigint' })
  file_size: string; // bigint columns are returned as string by pg driver

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    enumName: 'document_status_enum',
    default: DocumentStatus.DRAFT,
  })
  @Index()
  status: DocumentStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  /**
   * Points to the root document of a version chain. NULL for the first
   * version. All subsequent versions share the same "parent_document_id"
   * so the full history can be queried with a single WHERE clause.
   */
  @Column({ type: 'uuid', nullable: true, default: null })
  @Index()
  parent_document_id: string | null;

  @ManyToOne(() => Document, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_document_id' })
  parent_document: Document | null;

  // Lazy import to avoid circular reference at decoration time.
  // The actual type is imported dynamically by TypeORM at runtime.
  @OneToMany(
    'DocumentRecipient',
    (recipient: { document: Document }) => recipient.document,
  )
  recipients: DocumentRecipient[];

  @OneToMany(() => DocumentLock, (lock) => lock.document)
  locks: DocumentLock[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
