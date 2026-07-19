import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { normalizeEmail } from '../utils/normalize';

/**
 * Validates that a route parameter is a syntactically valid email address
 * using class-validator's isEmail, the same validator used in the DTOs.
 * Normalises to lowercase via normalizeEmail before passing to the handler.
 */
@Injectable()
export class ParseEmailPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException(`"${value}" is not a valid email address.`);
    }

    const normalizedValue = normalizeEmail(value);

    if (!isEmail(normalizedValue)) {
      throw new BadRequestException(
        `"${normalizedValue}" is not a valid email address.`,
      );
    }

    return normalizedValue;
  }
}
