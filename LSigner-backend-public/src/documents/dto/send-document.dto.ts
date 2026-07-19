import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { RecipientDto } from './recipient.dto';
import { ApplyLockDto } from '../../locks/dto/apply-lock.dto';

export class SendDocumentDto {
  @ApiProperty({
    description: 'List of recipients to send the document to',
    type: [RecipientDto],
    example: [
      { recipient_email: 'alice@example.com', recipient_name: 'Alice' },
      {
        recipient_email: 'bob@example.com',
        user_id: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiPropertyOptional({
    description:
      'Optional protection locks to apply to the document. ' +
      'Recipients must resolve all locks before downloading. ' +
      'Currently supported: PASSWORD.',
    type: [ApplyLockDto],
    example: [{ type: 'PASSWORD', password: 'secret123' }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyLockDto)
  locks?: ApplyLockDto[];
}
