import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { EntityManager, IsNull, MoreThan } from 'typeorm';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';
import { DocumentStatus } from '../entities/document.entity';
import { PublicLinkSession } from '../entities/public-link-session.entity';
import type { PublicSessionContext } from './public-session.types';

export interface BootstrapPublicSessionResult {
  status: 'AUTH_REQUIRED' | 'ANON_ALLOWED';
  documentId: string;
  sessionToken?: string;
}

@Injectable()
export class PublicSessionService {
  private readonly ttlMinutes: number;

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    configService: ConfigService,
  ) {
    this.ttlMinutes = configService.get<number>('app.publicSessionTtlMinutes')!;
  }

  getSessionCookieMaxAgeMs(): number {
    return this.ttlMinutes * 60 * 1000;
  }

  async bootstrapSession(
    publicLinkId: string,
    context: { ip: string | null; userAgent: string | null },
    transactionalEntityManager?: EntityManager,
  ): Promise<BootstrapPublicSessionResult> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { public_link_id: publicLinkId },
      relations: ['document'],
    });

    if (!recipient) {
      throw new NotFoundException('Invalid or expired public link');
    }

    if (recipient.document.status === DocumentStatus.VOIDED) {
      throw new NotFoundException('This document is no longer available');
    }

    if (recipient.signing_status === SigningStatus.REVOKED) {
      throw new NotFoundException('This public link is no longer available');
    }

    if (recipient.user_id) {
      return {
        status: 'AUTH_REQUIRED',
        documentId: recipient.document_id,
      };
    }

    await entityManager.update(
      PublicLinkSession,
      {
        recipient_id: recipient.id,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      {
        revoked_at: new Date(),
      },
    );

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = this.hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + this.getSessionCookieMaxAgeMs());

    const session = entityManager.create(PublicLinkSession, {
      recipient_id: recipient.id,
      session_hash: sessionHash,
      expires_at: expiresAt,
      last_used_at: new Date(),
      revoked_at: null,
      ip: context.ip,
      user_agent: context.userAgent,
    });
    await entityManager.save(session);

    return {
      status: 'ANON_ALLOWED',
      documentId: recipient.document_id,
      sessionToken,
    };
  }

  async resolvePublicSession(
    sessionToken: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<PublicSessionContext> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const sessionHash = this.hashSessionToken(sessionToken);

    const session = await entityManager.findOne(PublicLinkSession, {
      where: {
        session_hash: sessionHash,
      },
      relations: ['recipient', 'recipient.document'],
    });

    if (!session || session.revoked_at) {
      throw new ForbiddenException('Invalid public session');
    }

    if (session.expires_at <= new Date()) {
      throw new ForbiddenException('Public session expired');
    }

    if (session.recipient.user_id) {
      throw new ForbiddenException(
        'Public session not allowed for registered user',
      );
    }

    if (
      session.recipient.document.status === DocumentStatus.VOIDED ||
      session.recipient.signing_status === SigningStatus.REVOKED
    ) {
      throw new NotFoundException('This document is no longer available');
    }

    session.last_used_at = new Date();
    await entityManager.save(session);

    return {
      sessionId: session.id,
      recipientId: session.recipient_id,
      documentId: session.recipient.document_id,
      recipientEmail: session.recipient.recipient_email,
      recipientName: session.recipient.recipient_name,
    };
  }

  async revokeSession(
    sessionToken: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const sessionHash = this.hashSessionToken(sessionToken);

    await entityManager.update(
      PublicLinkSession,
      {
        session_hash: sessionHash,
        revoked_at: IsNull(),
      },
      { revoked_at: new Date() },
    );
  }

  private hashSessionToken(sessionToken: string): string {
    return crypto.createHash('sha256').update(sessionToken).digest('hex');
  }
}
