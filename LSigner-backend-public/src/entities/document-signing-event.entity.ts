import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { DocumentRecipient } from './document-recipient.entity';

/**
 * Immutable audit events for the recipient signing flow.
 *
 * - RECIPIENT_ACCOUNT_DELETED – recorded when a recipient's account
 *   deletion automatically expires their pending signature lines.
 */
export enum DocumentSigningEventAction {
  ACCESS_OPENED = 'ACCESS_OPENED',
  SIGNED = 'SIGNED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
  RECIPIENT_ACCOUNT_DELETED = 'RECIPIENT_ACCOUNT_DELETED',
}

@Entity({ name: 'document_signing_events' })
export class DocumentSigningEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  document_id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column()
  @Index()
  recipient_id: string;

  @ManyToOne(() => DocumentRecipient, (recipient) => recipient.signing_events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipient_id' })
  recipient: DocumentRecipient;

  @Column({
    type: 'enum',
    enum: DocumentSigningEventAction,
    enumName: 'document_signing_event_action_enum',
  })
  action: DocumentSigningEventAction;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  @Index()
  occurred_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
