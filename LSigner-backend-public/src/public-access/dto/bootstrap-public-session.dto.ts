import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BootstrapPublicSessionDto {
  @ApiProperty({
    description: 'Opaque public link identifier from the shared URL',
    example: '6fcf0f7f49c1468cb3c3777d2e5fdb90',
  })
  @IsString()
  @IsNotEmpty()
  publicLinkId: string;
}

export class BootstrapPublicSessionResponseDto {
  @ApiProperty({
    description:
      'AUTH_REQUIRED when recipient is registered, ANON_ALLOWED when anonymous access is allowed',
    enum: ['AUTH_REQUIRED', 'ANON_ALLOWED'],
    example: 'ANON_ALLOWED',
  })
  status: 'AUTH_REQUIRED' | 'ANON_ALLOWED';

  @ApiProperty({
    description: 'Document UUID tied to this shared recipient invitation',
    example: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
  })
  documentId: string;
}
