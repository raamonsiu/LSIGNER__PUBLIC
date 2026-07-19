import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OtpActionType } from '../otp/enums/otp-action-type.enum';
import { OtpResourceType } from '../otp/enums/otp-resource-type.enum';
import { OtpChallengeStatus } from '../otp/enums/otp-challenge-status.enum';

@Entity({ name: 'otp_challenges' })
@Index(['user_id', 'action_type', 'resource_type', 'resource_id', 'status'])
@Index(['user_id', 'action_type', 'resource_type', 'resource_id'], {
  unique: true,
  where: "status = 'ACTIVE'",
})
export class OtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  user_id: string;

  @Column({
    type: 'enum',
    enum: OtpActionType,
    enumName: 'otp_action_type_enum',
  })
  action_type: OtpActionType;

  @Column({
    type: 'enum',
    enum: OtpResourceType,
    enumName: 'otp_resource_type_enum',
  })
  resource_type: OtpResourceType;

  @Column()
  @Index()
  resource_id: string;

  @Column({ select: false })
  otp_hash: string;

  @Column({ select: false })
  otp_salt: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'int', default: 0 })
  attempt_count: number;

  @Column({ type: 'int' })
  max_attempts: number;

  @Column({ type: 'int', default: 0 })
  resend_count: number;

  @Column({ type: 'int' })
  max_resends: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  resend_available_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  locked_until: Date | null;

  @Column({
    type: 'enum',
    enum: OtpChallengeStatus,
    enumName: 'otp_challenge_status_enum',
    default: OtpChallengeStatus.ACTIVE,
  })
  @Index()
  status: OtpChallengeStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
