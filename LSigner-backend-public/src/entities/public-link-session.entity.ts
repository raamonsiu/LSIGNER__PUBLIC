import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentRecipient } from './document-recipient.entity';

@Entity({ name: 'public_link_sessions' })
export class PublicLinkSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  recipient_id: string;

  @ManyToOne(() => DocumentRecipient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: DocumentRecipient;

  @Column({ type: 'varchar', length: 64 })
  @Index({ unique: true })
  session_hash: string;

  @Column({ type: 'timestamptz' })
  @Index()
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  last_used_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  ip: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  user_agent: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
