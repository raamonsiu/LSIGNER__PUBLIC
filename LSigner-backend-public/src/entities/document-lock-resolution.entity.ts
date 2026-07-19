import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DocumentLock } from './document-lock.entity';
import { DocumentRecipient } from './document-recipient.entity';

/**
 * Records that a specific recipient has successfully resolved a document lock.
 *
 * The unique constraint on (lock_id, recipient_id) prevents double-resolution.
 * Lock resolution is per-recipient: each recipient must independently resolve
 * every lock on a document before being allowed to download it.
 */
@Entity({ name: 'document_lock_resolutions' })
@Unique(['lock_id', 'recipient_id'])
export class DocumentLockResolution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  lock_id: string;

  @ManyToOne(() => DocumentLock, (lock) => lock.resolutions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lock_id' })
  lock: DocumentLock;

  @Column()
  @Index()
  recipient_id: string;

  @ManyToOne(() => DocumentRecipient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: DocumentRecipient;

  /** Timestamp at which the recipient successfully resolved the lock. */
  @Column({ type: 'timestamptz' })
  resolved_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
