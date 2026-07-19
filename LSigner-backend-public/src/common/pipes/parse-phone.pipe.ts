import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { normalizePhone } from '../utils/normalize';

/**
 * Validates and normalises a phone number route parameter to E.164 format.
 * Delegates to normalizePhone which uses libphonenumber-js internally : the
 * same function used by UsersService on write, guaranteeing storage and query
 * formats are always identical.
 */
@Injectable()
export class ParsePhonePipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException(`"${value}" is not a valid phone number.`);
    }
    return normalizePhone(value);
  }
}
