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
import { Document } from './document.entity';
import { DocumentLockResolution } from './document-lock-resolution.entity';

/**
 * Lock types supported by the document protection system.
 *
 * The system follows a decorator/handler pattern: each LockType has a
 * corresponding LockHandler that encapsulates the apply/verify logic.
 * Adding a new lock type only requires registering a new handler.
 */
export enum LockType {
  PASSWORD = 'PASSWORD',
}

/**
 * Represents a protection lock applied to a document.
 *
 * Locks are created by the document owner at send time and must be resolved
 * by each recipient before they can download the document.
 *
 * The "config" column stores handler-specific data (e.g. derived key + salt
 * for a password lock). It is marked "select: false" so it is never returned
 * by default queries — load it explicitly only when verification is needed.
 */
@Entity({ name: 'document_locks' })
export class DocumentLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  document_id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({
    type: 'enum',
    enum: LockType,
    enumName: 'lock_type_enum',
  })
  lock_type: LockType;

  /**
   * Handler-specific hashed/encoded configuration stored as JSONB.
   * Shape depends on "lock_type":
   * - PASSWORD: "{ hash: string; salt: string }" (scrypt-derived key + salt)
   *
   * Marked "select: false" — never loaded unless explicitly requested.
   */
  @Column({ type: 'jsonb', select: false })
  config: Record<string, unknown>;

  @OneToMany(() => DocumentLockResolution, (resolution) => resolution.lock)
  resolutions: DocumentLockResolution[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
