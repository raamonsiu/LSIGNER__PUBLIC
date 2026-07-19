import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Document } from './document.entity';
import { DocumentRecipient } from './document-recipient.entity';

/**
 * Stores the signed artifact and cryptographic evidence for a recipient.
 */
@Entity({ name: 'document_signed_artifacts' })
@Unique(['document_id', 'recipient_id'])
export class DocumentSignedArtifact {
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

  @OneToOne(() => DocumentRecipient, (recipient) => recipient.signed_artifact, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipient_id' })
  recipient: DocumentRecipient;

  /** Signed document binary (placeholder until external signer integration). */
  @Column({ type: 'bytea', select: false })
  file: Buffer;

  @Column({ length: 64 })
  file_hash: string;

  /** Ed25519 signature over canonical payload (base64). */
  @Column({ type: 'text' })
  signature: string;

  @Column({ length: 50, default: 'Ed25519' })
  signature_algorithm: string;

  /** SHA-256 of DER-encoded Ed25519 public key (64 hex chars). */
  @Column({ length: 64 })
  key_fingerprint: string;

  /** Key version used to sign this artifact. Starts at 1. */
  @Column({ type: 'int', default: 1 })
  key_version: number;

  /** Links to previous artifact for the same document+recipient (chain-of-custody). */
  @Column({ type: 'uuid', nullable: true, default: null })
  previous_artifact_id: string | null;

  /** Raw 32-byte Ed25519 public key as hex. Stored per-artifact so verification is self-contained, even after key rotation. */
  @Column({ length: 64 })
  public_key_hex: string;

  /** Exact canonical JSON payload that was signed (deterministic, sorted keys). */
  @Column({ type: 'text', default: '' })
  canonical_payload: string;

  @Column({ type: 'jsonb', default: {} })
  evidence: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  signed_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
