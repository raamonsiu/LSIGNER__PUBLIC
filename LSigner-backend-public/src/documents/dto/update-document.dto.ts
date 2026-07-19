import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/normalize';

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description: 'New title of the document',
    example: 'Employment Contract 2026 – Revised',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'New description of the document',
    example: 'Updated contract with revised salary clause',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
