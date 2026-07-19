import { ApiProperty } from '@nestjs/swagger';
import { DocumentSigningEventAction } from '../../entities/document-signing-event.entity';

/**
 * Raw row shape returned by the UNION query in findTimelineForUser.
 * Internal type : not exposed via Swagger.
 */
export interface TimelineEventRow {
  event_id: string;
  document_id: string;
  document_name: string;
  action: DocumentSigningEventAction;
  occurred_at: string;
  direction: 'sent' | 'received';
  other_party_name: string | null;
  other_party_email: string;
}

export class TimelineEventDto {
  @ApiProperty({
    description: 'UUID of the signing event',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  event_id: string;

  @ApiProperty({
    description: 'UUID of the document',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  document_id: string;

  @ApiProperty({
    description: 'Title of the document',
    example: 'NDA ACME',
  })
  document_name: string;

  @ApiProperty({
    description:
      'Action performed: SENT (document dispatched), RECEIVED (document received), or a signing event',
    enum: [
      'SENT',
      'RECEIVED',
      'ACCESS_OPENED',
      'SIGNED',
      'REJECTED',
      'REVOKED',
    ],
    example: 'SIGNED',
  })
  action: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp of when the event occurred',
    example: '2026-07-02T14:00:00.000Z',
  })
  occurred_at: string;

  @ApiProperty({
    description:
      'Direction of the event: "sent" if the user owns the document, "received" if the user is a recipient',
    enum: ['sent', 'received'],
    example: 'sent',
  })
  direction: 'sent' | 'received';

  @ApiProperty({
    description:
      'Name of the other party (recipient for sent events, owner for received events)',
    nullable: true,
    example: 'Alice Example',
  })
  other_party_name: string | null;

  @ApiProperty({
    description:
      'Email of the other party (recipient for sent events, owner for received events)',
    example: 'alice@example.com',
  })
  other_party_email: string;
}

export class TimelineResponseDto {
  @ApiProperty({
    description: 'Chronological list of signing events (most recent first)',
    type: [TimelineEventDto],
  })
  items: TimelineEventDto[];
}
