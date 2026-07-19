import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifySignatureArtifactDto {
  @ApiProperty({ description: 'UUID of the signed artifact' })
  id: string;

  @ApiProperty({ description: 'Ed25519 signature in base64 format' })
  signature: string;

  @ApiProperty({ description: 'Signature algorithm (always Ed25519)' })
  signature_algorithm: string;

  @ApiProperty({
    description: 'SHA-256 fingerprint of the public key that signed this',
  })
  key_fingerprint: string;

  @ApiProperty({ description: 'Key version used (for key rotation)' })
  key_version: number;

  @ApiProperty({
    description: 'ID of the previous artifact in the chain-of-custody, or null',
  })
  previous_artifact_id: string | null;

  @ApiProperty({ description: 'ISO timestamp when the artifact was created' })
  signed_at: string;
}

export class VerifySignatureResponseDto {
  @ApiProperty({ description: 'Document UUID' })
  document_id: string;

  @ApiProperty({ description: 'Recipient UUID' })
  recipient_id: string;

  @ApiProperty({ description: 'The signed artifact metadata' })
  artifact: VerifySignatureArtifactDto;

  @ApiProperty({
    description:
      'Ed25519 public key (raw 32 bytes) as hex. Use this for external verification.',
    example: 'ea6ddde6e3f3c02ffdf9088dcb53cd1ea6807e32f5eb0dd32af2f53ef38ec142',
  })
  public_key_hex: string;

  @ApiProperty({
    description:
      'Ed25519 signature as hex (128 chars). Paste THIS into verification tools, NOT the base64 signature above.',
    example:
      '0544511ebc95b7033872539f74c094d7b6f470e02e68e5f1ac47e46843ccc7e8...',
  })
  signature_hex: string | null;

  @ApiProperty({
    description:
      'Exact JSON payload that was cryptographically signed. Copy the raw version from GET /verify/:id/:recipientId/raw to avoid JSON escaping.',
  })
  canonical_payload: string;

  @ApiProperty({
    description:
      'Whether the server successfully verified the signature on its own side',
  })
  server_verified: boolean;

  @ApiPropertyOptional({
    description:
      'If verification failed, explains why (e.g. old signing method, key mismatch)',
  })
  server_error: string | null;

  @ApiProperty({
    description:
      'How to verify this signature externally using any Ed25519 tool',
    example: [
      '1. Copy public_key_hex',
      '2. Copy canonical_payload from GET :id/verify/:recipientId/raw',
      '3. Copy signature_hex',
      '4. Paste all three into any Ed25519 verification tool (e.g. cyphr.me/ed25519-tool)',
    ],
  })
  verification_steps: string[];
}
