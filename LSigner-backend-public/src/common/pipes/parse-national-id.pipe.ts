import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { NATIONAL_ID_REGEX } from '../utils/regex';
import { normalizeDocumentId } from '../utils/normalize';

/**
 * Validates that a route parameter is a well-formed national identity document
 * number: 1-50 alphanumeric characters, optionally joined by hyphens.
 * Normalises to uppercase via normalizeDocumentId :the same function used by
 * UsersService on write, guaranteeing storage and query formats are identical.
 */
@Injectable()
export class ParseNationalIdPipe implements PipeTransform<string> {
  transform(value: string): string {
    const normalizedValue = value ? normalizeDocumentId(value) : '';

    if (!normalizedValue || !NATIONAL_ID_REGEX.test(normalizedValue)) {
      throw new BadRequestException(
        `"${value}" is not a valid national ID. Only letters, digits and hyphens are allowed (1-50 characters).`,
      );
    }

    return normalizedValue;
  }
}
