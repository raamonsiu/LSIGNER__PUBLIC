import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError } from 'typeorm';
import * as crypto from 'crypto';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';
import {
  DocumentSigningEvent,
  DocumentSigningEventAction,
} from '../entities/document-signing-event.entity';
import { DocumentSignedArtifact } from '../entities/document-signed-artifact.entity';
import { SignSharedDocumentDto } from './dto/sign-shared-document.dto';
import { RejectSharedDocumentDto } from './dto/reject-shared-document.dto';
import { RevokeSharedDocumentDto } from './dto/revoke-shared-document.dto';
import { RevokeRecipientSigningDto } from './dto/revoke-recipient-signing.dto';
import { SignedDocumentResultDto } from './dto/signed-document-result.dto';
import { LocksService } from '../locks/locks.service';
import { VerificationMethod } from './dto/verification-method.enum';
import { OtpActionType } from '../otp/enums/otp-action-type.enum';
import type { ActionResultDto } from '../otp/dto/otp-verify-response.dto';
import { EmailService } from '../email/email.service';
import { User } from '../entities/user.entity';
import { findRecipientById } from '../shared/recipient-helper';

export interface AccessContext {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class DocumentSigningService {
  private readonly logger = new Logger(DocumentSigningService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly configService: ConfigService,
    private readonly locksService: LocksService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Registers recipient access timestamps and appends an immutable audit event.
   */
  async recordAccessForRecipient(
    recipient: DocumentRecipient,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const now = new Date();
    const isFirstAccess = recipient.first_accessed_at === null;

    if (isFirstAccess) {
      recipient.first_accessed_at = now;
    }
    recipient.last_accessed_at = now;

    await entityManager.save(recipient);

    await this.createEvent(
      recipient,
      DocumentSigningEventAction.ACCESS_OPENED,
      {
        ip: context.ip,
        user_agent: context.userAgent,
        is_first_access: isFirstAccess,
      },
      now,
      entityManager,
    );
  }

  /**
   * Finds recipient by access token, updates access timestamps and appends event.
   */
  async recordAccessByPublicLinkId(
    publicLinkId: string,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientByPublicLinkId(
      publicLinkId,
      entityManager,
    );

    await this.recordAccessForRecipient(recipient, context, entityManager);
  }

  /**
   * Finds recipient by recipient id, updates access timestamps and appends event.
   */
  async recordAccessByRecipientId(
    recipientId: string,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await findRecipientById(recipientId, entityManager);

    await this.recordAccessForRecipient(recipient, context, entityManager);
  }

  /**
   * Builds Ed25519 signature evidence for a signing action.
   */
  private buildSignatureEvidence(
    document: Document,
    recipient: DocumentRecipient,
    state: string,
    context: AccessContext,
    verificationMethod: string,
    verificationReference: string | null,
    keyVersion: number,
    previousArtifactId: string | null,
    now: Date,
  ): {
    evidence: Record<string, unknown>;
    signature: string;
    canonical: string;
  } {
    const privateKey = this.configService.get<{
      privateKey: crypto.KeyObject;
      publicKey: crypto.KeyObject;
      fingerprint: string;
      keyVersion: number;
    }>('signing');

    if (!privateKey?.privateKey) { // Shouldn happen
      throw new InternalServerErrorException(
        'Document signing key is not configured',
      );
    }

    const evidence: Record<string, unknown> = {
      verification_method: verificationMethod,
      verification_reference: verificationReference,
      recipient_email: recipient.recipient_email,
      recipient_name: recipient.recipient_name,
      ip: context.ip,
      user_agent: context.userAgent,
      signed_at: now.toISOString(),
      mime_type: document.mime_type,
      original_filename: document.original_filename,
    };

    const canonicalPayload = {
      actor_id: recipient.id,
      actor_type: 'RECIPIENT',
      document_id: document.id,
      file_hash: document.file_hash,
      key_version: keyVersion,
      previous_artifact_id: previousArtifactId,
      recipient_id: recipient.id,
      state,
      timestamp: now.toISOString(),
    };

    // Deterministic JSON with sorted keys
    const canonical = JSON.stringify(
      canonicalPayload,
      Object.keys(canonicalPayload).sort(),
    );

    const message = Buffer.from(canonical, 'utf8');
    const signatureBuffer = crypto.sign(null, message, privateKey.privateKey);
    const signature = signatureBuffer.toString('base64');

    return { evidence, signature, canonical };
  }

  /**
   * Finds the most recent signed artifact for a document+recipient pair.
   * Returns null if no prior artifact exists.
   */
  private async findPreviousArtifact(
    documentId: string,
    recipientId: string,
    entityManager: EntityManager,
  ): Promise<DocumentSignedArtifact | null> {
    return entityManager.findOne(DocumentSignedArtifact, {
      where: { document_id: documentId, recipient_id: recipientId },
      order: { signed_at: 'DESC' },
    });
  }

  /**
   * Executes the full sign pipeline: validate status -> check locks -> fetch doc ->
   * find previous artifact -> build Ed25519 evidence -> create artifact -> save recipient -> create event.
   */
  private async executeSignPipeline(
    recipient: DocumentRecipient,
    dto: SignSharedDocumentDto,
    context: AccessContext,
    entityManager: EntityManager,
  ): Promise<SignedDocumentResultDto> {
    if (recipient.signing_status === SigningStatus.SIGNED) {
      throw new ConflictException('This document has already been signed');
    }
    if (recipient.signing_status === SigningStatus.REJECTED) {
      throw new ConflictException(
        'This document was rejected and cannot be signed',
      );
    }
    if (recipient.signing_status === SigningStatus.REVOKED) {
      throw new ConflictException(
        'Signing access for this document was revoked',
      );
    }

    // REQ-SIGN-001: Block signing on deleted-sender documents
    const owner = await entityManager.findOne(User, {
      where: { patient_id: recipient.document.owner_id },
      select: ['patient_id', 'deleted_at'],
    });
    if (owner?.deleted_at) {
      throw new GoneException('The owner has removed his account');
    }

    const hasUnresolvedLocks = await this.locksService.hasUnresolvedLocks(
      recipient.document_id,
      recipient.id,
      entityManager,
    );
    if (hasUnresolvedLocks) {
      throw new ForbiddenException(
        'You must resolve all document locks before signing',
      );
    }

    const documentWithFile = await entityManager
      .createQueryBuilder(Document, 'doc')
      .select([
        'doc.id',
        'doc.file',
        'doc.file_hash',
        'doc.original_filename',
        'doc.mime_type',
      ])
      .where('doc.id = :id', { id: recipient.document_id })
      .getOne();

    if (!documentWithFile) {
      throw new NotFoundException('Document not found');
    }

    const signingConfig = this.configService.get<{
      fingerprint: string;
      keyVersion: number;
      publicKeyHex: string;
    }>('signing');

    if (!signingConfig?.fingerprint) { // Shouldnt happen //TODO: Make helper common function to test this
      throw new InternalServerErrorException(
        'Document signing keys are not configured',
      );
    }

    const now = new Date();
    const verificationMethod = dto.verification_method ?? 'OTP';

    const previousArtifact = await this.findPreviousArtifact(
      recipient.document_id,
      recipient.id,
      entityManager,
    );

    const { evidence, signature, canonical } = this.buildSignatureEvidence(
      documentWithFile,
      recipient,
      'SIGNED',
      context,
      verificationMethod,
      dto.verification_reference ?? null,
      signingConfig.keyVersion,
      previousArtifact?.id ?? null,
      now,
    );

    const artifact = entityManager.create(DocumentSignedArtifact, {
      document_id: documentWithFile.id,
      recipient_id: recipient.id,
      file: documentWithFile.file,
      file_hash: documentWithFile.file_hash,
      signature,
      signature_algorithm: 'Ed25519',
      key_fingerprint: signingConfig.fingerprint,
      key_version: signingConfig.keyVersion,
      previous_artifact_id: previousArtifact?.id ?? null,
      public_key_hex: signingConfig.publicKeyHex,
      canonical_payload: canonical,
      evidence,
      signed_at: now,
    });

    let savedArtifact: DocumentSignedArtifact;
    try {
      savedArtifact = await entityManager.save(artifact);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new ConflictException('This document has already been signed');
      }
      throw err;
    }

    if (recipient.first_accessed_at === null) {
      recipient.first_accessed_at = now;
    }
    recipient.last_accessed_at = now;
    recipient.signing_status = SigningStatus.SIGNED;
    recipient.signed_at = now;
    await entityManager.save(recipient);

    await this.createEvent(
      recipient,
      DocumentSigningEventAction.SIGNED,
      {
        verification_method: verificationMethod,
        verification_reference: dto.verification_reference ?? null,
        ip: context.ip,
        user_agent: context.userAgent,
        signature_algorithm: 'Ed25519',
        key_fingerprint: signingConfig.fingerprint,
      },
      now,
      entityManager,
    );

    // Fire-and-forget: notify document owner about signing
    void this.notifyOwner(
      recipient,
      'SIGNED',
      recipient.recipient_name ?? 'A signer',
      now,
    );

    return {
      artifact_id: savedArtifact.id,
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      status: 'SIGNED',
      signed_at: now.toISOString(),
      signature_algorithm: 'Ed25519',
    };
  }

  /**
   * Signs a shared document after lock resolution and stores signature evidence.
   */
  async signByPublicLinkId(
    publicLinkId: string,
    dto: SignSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<SignedDocumentResultDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientByPublicLinkId(
      publicLinkId,
      entityManager,
    );

    return this.executeSignPipeline(recipient, dto, context, entityManager);
  }

  /**
   * Signs a shared document by recipient id (public session flow).
   */
  async signByRecipientId(
    recipientId: string,
    dto: SignSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<SignedDocumentResultDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await findRecipientById(recipientId, entityManager);

    return this.executeSignPipeline(recipient, dto, context, entityManager);
  }

  /**
   * Executes the reject pipeline: validate status -> set REJECTED -> save -> create event.
   */
  private async executeRejectPipeline(
    recipient: DocumentRecipient,
    reason: string | undefined,
    context: AccessContext,
    verifyMetadata: {
      verification_method?: string;
      verification_reference?: string | null;
    },
    entityManager: EntityManager,
  ): Promise<void> {
    if (recipient.signing_status === SigningStatus.SIGNED) {
      throw new ConflictException(
        'This document was already signed and cannot be rejected',
      );
    }
    if (recipient.signing_status === SigningStatus.REJECTED) {
      throw new ConflictException('This document was already rejected');
    }
    if (recipient.signing_status === SigningStatus.REVOKED) {
      throw new ConflictException(
        'Signing access for this document was revoked',
      );
    }

    const now = new Date();
    if (recipient.first_accessed_at === null) {
      recipient.first_accessed_at = now;
    }
    recipient.last_accessed_at = now;
    recipient.signing_status = SigningStatus.REJECTED;
    recipient.signed_at = null;
    await entityManager.save(recipient);

    await this.createEvent(
      recipient,
      DocumentSigningEventAction.REJECTED,
      {
        verification_method: verifyMetadata.verification_method ?? null,
        verification_reference: verifyMetadata.verification_reference ?? null,
        reason: reason ?? null,
        ip: context.ip,
        user_agent: context.userAgent,
      },
      now,
      entityManager,
    );

    // Fire-and-forget: notify document owner about rejection
    void this.notifyOwner(
      recipient,
      'REJECTED',
      recipient.recipient_name ?? 'A recipient',
      now,
    );
  }

  /**
   * Marks a recipient as rejected and appends an audit event.
   */
  async rejectByPublicLinkId(
    publicLinkId: string,
    dto: RejectSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientByPublicLinkId(
      publicLinkId,
      entityManager,
    );

    await this.executeRejectPipeline(
      recipient,
      dto.reason,
      context,
      {
        verification_method: dto.verification_method,
        verification_reference: dto.verification_reference,
      },
      entityManager,
    );
  }

  /**
   * Marks a recipient as rejected by recipient id (public session flow).
   */
  async rejectByRecipientId(
    recipientId: string,
    dto: RejectSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await findRecipientById(recipientId, entityManager);

    await this.executeRejectPipeline(
      recipient,
      dto.reason,
      context,
      {
        verification_method: dto.verification_method,
        verification_reference: dto.verification_reference,
      },
      entityManager,
    );
  }

  /**
   * Marks a recipient as rejected by authenticated user ID (not access token).
   * Used by the received-documents reject endpoint.
   * Throws 404 if the recipient record is not found or document is not SENT.
   * Throws 409 for invalid state transitions.
   */
  async rejectByRecipientUserId(
    documentId: string,
    userId: string,
    dto: { reason?: string },
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<{ id: string; status: string; rejected_at: string }> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { document_id: documentId, user_id: userId },
      relations: ['document'],
    });

    if (!recipient || recipient.document.status !== DocumentStatus.SENT) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    await this.executeRejectPipeline(
      recipient,
      dto.reason,
      context,
      { verification_method: undefined, verification_reference: undefined },
      entityManager,
    );

    return {
      id: documentId,
      status: 'REJECTED',
      rejected_at: new Date().toISOString(),
    };
  }

  /**
   * Executes the revoke pipeline: validate -> set REVOKED -> save -> create event.
   */
  private async executeRevokePipeline(
    recipient: DocumentRecipient,
    context: AccessContext,
    verifyMetadata: {
      verification_method?: string;
      verification_reference?: string | null;
      reason?: string | null;
    },
    entityManager: EntityManager,
  ): Promise<void> {
    if (recipient.signing_status === SigningStatus.REVOKED) {
      return;
    }

    const now = new Date();
    if (recipient.first_accessed_at === null) {
      recipient.first_accessed_at = now;
    }

    recipient.last_accessed_at = now;
    recipient.signing_status = SigningStatus.REVOKED;
    await entityManager.save(recipient);

    await this.createEvent(
      recipient,
      DocumentSigningEventAction.REVOKED,
      {
        verification_method: verifyMetadata.verification_method ?? null,
        verification_reference: verifyMetadata.verification_reference ?? null,
        reason: verifyMetadata.reason ?? null,
        revoked_by: 'RECIPIENT',
        ip: context.ip,
        user_agent: context.userAgent,
      },
      now,
      entityManager,
    );

    // Fire-and-forget: notify document owner about revocation
    void this.notifyOwner(
      recipient,
      'REVOKED',
      recipient.recipient_name ?? 'A recipient',
      now,
    );
  }

  /**
   * Revokes a previously signed or pending recipient action from shared link.
   */
  async revokeByPublicLinkId(
    publicLinkId: string,
    dto: RevokeSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientByPublicLinkId(
      publicLinkId,
      entityManager,
    );

    await this.executeRevokePipeline(
      recipient,
      context,
      {
        verification_method: dto.verification_method,
        verification_reference: dto.verification_reference,
        reason: dto.reason,
      },
      entityManager,
    );
  }

  /**
   * Revokes a previously signed or pending recipient action by recipient id.
   */
  async revokeByRecipientId(
    recipientId: string,
    dto: RevokeSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await findRecipientById(recipientId, entityManager);

    await this.executeRevokePipeline(
      recipient,
      context,
      {
        verification_method: dto.verification_method,
        verification_reference: dto.verification_reference,
        reason: dto.reason,
      },
      entityManager,
    );
  }

  /**
   * Signs a document for a recipient identified by their user ID (JWT flow).
   */
  async signByRecipientUserId(
    documentId: string,
    userId: string,
    dto: SignSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<SignedDocumentResultDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { document_id: documentId, user_id: userId },
      relations: ['document'],
    });

    if (!recipient || recipient.document.status !== DocumentStatus.SENT) {
      throw new NotFoundException(`Document ${documentId} not found for user with id ${userId}`);
    }

    return this.executeSignPipeline(recipient, dto, context, entityManager);
  }

  /**
   * Revokes a previously signed or pending recipient action by user ID (JWT flow).
   */
  async revokeByRecipientUserId(
    documentId: string,
    userId: string,
    dto: RevokeSharedDocumentDto,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { document_id: documentId, user_id: userId },
      relations: ['document'],
    });

    if (!recipient || recipient.document.status !== DocumentStatus.SENT) {
      throw new NotFoundException(`Document ${documentId} not found for user with id ${userId}`);
    }

    await this.executeRevokePipeline(
      recipient,
      context,
      {
        verification_method: dto.verification_method,
        verification_reference: dto.verification_reference,
        reason: dto.reason,
      },
      entityManager,
    );
  }

  /**
   * Revokes signing access for a recipient owned by the current user.
   * Returns email context so the controller can fire-and-forget after the
   * transaction commits.
   */
  async revokeRecipientByOwner(
    documentId: string,
    recipientId: string,
    ownerId: string,
    dto: RevokeRecipientSigningDto = {},
    transactionalEntityManager?: EntityManager,
  ): Promise<{
    recipientEmail: string;
    recipientName: string;
    documentName: string;
    senderName: string;
  } | void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const document = await entityManager.findOne(Document, {
      where: { id: documentId },
      select: ['id', 'owner_id', 'status', 'title'],
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (document.owner_id !== ownerId) {
      throw new ForbiddenException('You do not own this document');
    }
    if (document.status === DocumentStatus.DRAFT) {
      throw new ConflictException(
        'Cannot revoke a recipient on a document that was not sent',
      );
    }

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { id: recipientId, document_id: documentId },
    });
    if (!recipient) {
      throw new NotFoundException(
        `Recipient ${recipientId} not found for document ${documentId}`,
      );
    }

    if (recipient.signing_status === SigningStatus.SIGNED) {
      throw new ConflictException(
        'Cannot revoke a recipient that already signed',
      );
    }

    // Fetch owner user for sender name
    const owner = await entityManager.findOne(User, {
      where: { patient_id: ownerId },
      select: ['patient_id', 'name', 'last_name'],
    });
    const senderName = owner
      ? `${owner.name} ${owner.last_name}`
      : 'Unknown sender';

    const emailContext = {
      recipientEmail: recipient.recipient_email,
      recipientName: recipient.recipient_name ?? 'there',
      documentName: document.title,
      senderName,
    };

    if (recipient.signing_status === SigningStatus.REVOKED) {
      return emailContext;
    }

    const now = new Date();
    recipient.signing_status = SigningStatus.REVOKED;
    recipient.last_accessed_at = recipient.last_accessed_at ?? now;
    await entityManager.save(recipient);

    await this.createEvent(
      recipient,
      DocumentSigningEventAction.REVOKED,
      {
        reason: dto.reason ?? null,
        revoked_by: ownerId,
      },
      now,
      entityManager,
    );

    return emailContext;
  }

  private async findRecipientByPublicLinkId(
    publicLinkId: string,
    entityManager: EntityManager,
  ): Promise<DocumentRecipient> {
    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { public_link_id: publicLinkId },
      relations: ['document'],
    });

    if (!recipient) {
      throw new NotFoundException('Invalid or expired public link');
    }

    if (
      recipient.document.status === DocumentStatus.VOIDED ||
      recipient.document.status === DocumentStatus.DELETED
    ) {
      throw new NotFoundException('This document is no longer available');
    }

    return recipient;
  }

  /**
   * Validates that the requested OTP action is allowed for the given
   * document and signing statuses.
   */
  validateDocumentAction(
    actionType: OtpActionType,
    documentStatus: DocumentStatus,
    signingStatus: string | undefined,
  ): void {
    if (
      documentStatus === DocumentStatus.VOIDED ||
      documentStatus === DocumentStatus.DELETED
    ) {
      throw new NotFoundException('This document is no longer available');
    }

    if (!signingStatus) {
      return;
    }

    switch (actionType) {
      case OtpActionType.SIGN:
        if (signingStatus === 'SIGNED') {
          throw new ConflictException('This document has already been signed');
        }
        if (signingStatus === 'REJECTED') {
          throw new ConflictException(
            'This document was rejected and cannot be signed',
          );
        }
        if (signingStatus === 'REVOKED') {
          throw new ConflictException(
            'Signing access for this document was revoked',
          );
        }
        break;
      case OtpActionType.REJECT:
        if (signingStatus === 'SIGNED') {
          throw new ConflictException(
            'This document was already signed and cannot be rejected',
          );
        }
        if (signingStatus === 'REJECTED') {
          throw new ConflictException('This document was already rejected');
        }
        if (signingStatus === 'REVOKED') {
          throw new ConflictException(
            'Signing access for this document was revoked',
          );
        }
        break;
      case OtpActionType.REVOKE:
        if (signingStatus === 'REVOKED') {
          throw new ConflictException('This document was already revoked');
        }
        break;
    }
  }

  /**
   * Executes the action stored in a verified OTP challenge for a user
   * identified by their user ID (JWT flow).
   */
  async executeOtpActionByUserId(
    actionType: OtpActionType,
    documentId: string,
    userId: string,
    challengeId: string,
    context: AccessContext,
    reason: string | undefined,
    transactionalEntityManager?: EntityManager,
  ): Promise<ActionResultDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    switch (actionType) {
      case OtpActionType.SIGN: {
        const result = await this.signByRecipientUserId(
          documentId,
          userId,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: challengeId,
          },
          context,
          entityManager,
        );

        return {
          resourceType: 'DOCUMENT',
          resourceId: documentId,
          newStatus: 'SIGNED',
          metadata: {
            artifactId: result.artifact_id,
            recipientId: result.recipient_id,
          },
        };
      }

      case OtpActionType.REJECT: {
        await this.rejectByRecipientUserId(
          documentId,
          userId,
          { reason },
          context,
          entityManager,
        );

        return {
          resourceType: 'DOCUMENT',
          resourceId: documentId,
          newStatus: 'REJECTED',
        };
      }

      case OtpActionType.REVOKE: {
        await this.revokeByRecipientUserId(
          documentId,
          userId,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: challengeId,
            reason,
          },
          context,
          entityManager,
        );

        return {
          resourceType: 'DOCUMENT',
          resourceId: documentId,
          newStatus: 'REVOKED',
        };
      }

      default:
        throw new ConflictException('Unknown action type');
    }
  }

  /**
   * Executes the action stored in a verified OTP challenge for a recipient
   * identified by recipient ID (public session flow).
   */
  async executeOtpActionByRecipientId(
    actionType: OtpActionType,
    recipientId: string,
    resourceId: string,
    challengeId: string,
    context: AccessContext,
    reason: string | undefined,
    transactionalEntityManager?: EntityManager,
  ): Promise<ActionResultDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    switch (actionType) {
      case OtpActionType.SIGN: {
        const result = await this.signByRecipientId(
          recipientId,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: challengeId,
          },
          context,
          entityManager,
        );

        return {
          resourceType: 'DOCUMENT',
          resourceId,
          newStatus: 'SIGNED',
          metadata: {
            artifactId: result.artifact_id,
            recipientId: result.recipient_id,
          },
        };
      }

      case OtpActionType.REJECT: {
        await this.rejectByRecipientId(
          recipientId,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: challengeId,
            reason,
          },
          context,
          entityManager,
        );

        return {
          resourceType: 'DOCUMENT',
          resourceId,
          newStatus: 'REJECTED',
        };
      }

      case OtpActionType.REVOKE: {
        await this.revokeByRecipientId(
          recipientId,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: challengeId,
            reason,
          },
          context,
          entityManager,
        );

        return {
          resourceType: 'DOCUMENT',
          resourceId,
          newStatus: 'REVOKED',
        };
      }

      default:
        throw new ConflictException('Unknown action type');
    }
  }

  /**
   * Fire-and-forget notification to the document owner.
   * Suppresses the email when the actor is the document owner.
   */
  private async notifyOwner(
    recipient: DocumentRecipient,
    action: 'SIGNED' | 'REJECTED' | 'REVOKED',
    actorName: string,
    occurredAt: Date,
  ): Promise<void> {
    try {
      const document = recipient.document;
      if (!document?.owner_id) return;

      // Self-suppression: owner performing the action on their own document
      if (recipient.user_id && document.owner_id === recipient.user_id) return;

      const owner = await this.entityManager.findOne(User, {
        where: { patient_id: document.owner_id },
        select: ['patient_id', 'name', 'last_name', 'email'],
      });
      if (!owner?.email) return;

      const documentName = document.title ?? 'a document';
      const timestamp = occurredAt.toISOString();
      const ownerName = `${owner.name} ${owner.last_name}`;

      switch (action) {
        case 'SIGNED':
          void this.emailService
            .sendSignedNotification(
              owner.email,
              documentName,
              actorName,
              timestamp,
              ownerName,
            )
            .catch((err) => {
              this.logger.error('Failed to send signed notification', err);
            });
          break;
        case 'REJECTED':
          void this.emailService
            .sendRejectedNotification(
              owner.email,
              documentName,
              actorName,
              timestamp,
              ownerName,
            )
            .catch((err) => {
              this.logger.error('Failed to send rejected notification', err);
            });
          break;
        case 'REVOKED':
          void this.emailService
            .sendRevokedNotification(
              owner.email,
              documentName,
              actorName,
              timestamp,
              ownerName,
            )
            .catch((err) => {
              this.logger.error('Failed to send revoked notification', err);
            });
          break;
      }
    } catch (err) {
      this.logger.error(`Failed to notify document owner for ${action}`, err);
    }
  }

  private async createEvent(
    recipient: DocumentRecipient,
    action: DocumentSigningEventAction,
    metadata: Record<string, unknown>,
    occurredAt: Date,
    entityManager: EntityManager,
  ): Promise<void> {
    const event = entityManager.create(DocumentSigningEvent, {
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      action,
      metadata,
      occurred_at: occurredAt,
    });

    await entityManager.save(event);
  }
}
