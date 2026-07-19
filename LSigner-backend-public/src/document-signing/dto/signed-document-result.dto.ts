import { ApiProperty } from '@nestjs/swagger';

export class SignedDocumentResultDto {
  @ApiProperty({
    description: 'Signed artifact UUID',
    example: '9e13af0a-f808-47e6-9e7f-7403eb5ee032',
  })
  artifact_id: string;

  @ApiProperty({
    description: 'Document UUID',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  document_id: string;

  @ApiProperty({
    description: 'Recipient UUID',
    example: 'bb4ef8d8-1302-44bb-8f5d-d0822710c431',
  })
  recipient_id: string;

  @ApiProperty({
    description: 'Signature status after operation',
    example: 'SIGNED',
  })
  status: 'SIGNED';

  @ApiProperty({
    description: 'UTC timestamp when signature was recorded',
    example: '2026-06-22T17:25:48.102Z',
  })
  signed_at: string;

  @ApiProperty({
    description: 'Algorithm used to generate server signature evidence',
    example: 'HMAC-SHA256',
  })
  signature_algorithm: string;
}
