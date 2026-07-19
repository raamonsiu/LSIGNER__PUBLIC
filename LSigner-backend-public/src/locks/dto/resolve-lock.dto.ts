import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload sent by a recipient when resolving a document lock.
 *
 * Each lock type uses its own subset of fields:
 * - PASSWORD: "password" is required.
 *
 * Future lock types will add new optional fields here.
 */
export class ResolveLockDto {
  @ApiPropertyOptional({
    description: 'Plaintext password for PASSWORD-type locks.',
    example: 'secret123',
  })
  @IsOptional()
  @IsString()
  password?: string;
}
