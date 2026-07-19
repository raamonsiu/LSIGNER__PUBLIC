import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Represents a registered user (patient) in the system.
 * Sensitive fields ("password", "salt") are excluded from query results by
 * default via "select: false" and must be loaded explicitly when needed.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  patient_id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 200 })
  last_name: string;

  @Column({ length: 100 })
  country: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
    default: null,
  })
  national_id: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
    default: null,
  })
  passport: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true, default: null })
  email: string;

  @Column({
    type: 'varchar',
    length: 30,
    unique: true,
    nullable: true,
    default: null,
  })
  // Stored in E.164 format (e.g. +34600000000) for consistent lookups
  // and to avoid ambiguities across locales. Normalisation is performed
  // by the request pipe prior to persistence.
  phone_number: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;

  @Column({ select: false }) // Select false to exclude from queries by default
  password: string;

  @Column({ select: false }) // Select false to exclude from queries by default
  salt: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
