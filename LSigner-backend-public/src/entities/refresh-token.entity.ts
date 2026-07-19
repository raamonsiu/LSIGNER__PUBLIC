import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Persisted record for a single-use opaque refresh token.
 *
 * The raw token is never stored — only its SHA-256 hex digest is persisted so
 * that a DB leak cannot be used to re-issue access tokens.
 *
 * Token rotation is enforced: every call to POST /auth/refresh revokes the
 * current record and creates a new one.
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** SHA-256 (hex, 64 chars) digest of the raw opaque refresh token. */
  @Column({ length: 64 })
  token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn()
  created_at: Date;
}
