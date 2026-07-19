import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/normalize';

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Title of the document',
    example: 'Employment Contract 2026',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Optional description of the document',
    example: 'Standard employment contract for new hires',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
