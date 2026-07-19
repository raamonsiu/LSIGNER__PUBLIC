import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { PASSPORT_REGEX } from '../utils/regex';
import { normalizeDocumentId } from '../utils/normalize';

/**
 * Validates that a route parameter is a well-formed passport number:
 * 6-20 alphanumeric characters, optionally joined by a single hyphen.
 * Normalises to uppercase via normalizeDocumentId : the same function used by
 * UsersService on write, guaranteeing storage and query formats are identical.
 */
@Injectable()
export class ParsePassportPipe implements PipeTransform<string> {
  transform(value: string): string {
    const normalizedValue = value ? normalizeDocumentId(value) : '';

    if (!normalizedValue || !PASSPORT_REGEX.test(normalizedValue)) {
      throw new BadRequestException(
        `"${value}" is not a valid passport number. Only letters, digits and hyphens are allowed (6-20 characters).`,
      );
    }

    return normalizedValue;
  }
}
