import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactResponseDto {
  @ApiProperty({
    description: 'Contact UUID',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  id: string;

  @ApiProperty({
    description: 'Email address of the contact',
    example: 'alice@example.com',
  })
  contact_email: string;

  @ApiPropertyOptional({
    description: 'Display name of the contact',
    example: 'Alice Example',
    nullable: true,
  })
  contact_name?: string | null;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format',
    example: '+34600000000',
    nullable: true,
  })
  contact_phone?: string | null;

  @ApiPropertyOptional({
    description: 'UUID of the registered user, if linked',
    example: 'b4cc290f-9ca0-4999-0023-bdf5f7654113',
    nullable: true,
  })
  contact_user_id?: string | null;

  @ApiProperty({
    description: 'ISO 8601 creation timestamp',
    example: '2026-01-01T00:00:00.000Z',
  })
  created_at: string;
}
