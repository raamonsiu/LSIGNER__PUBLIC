import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalises an email address to lowercase for consistent storage and lookups.
 * Does not validate format : use class-validator's isEmail for that.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Parses a phone number and returns its canonical E.164 representation.
 * Throws BadRequestException if the number cannot be parsed or is not valid.
 * This function is used by both ParsePhonePipe (route params) and UsersService
 * (body writes) to guarantee storage and query formats are identical.
 */
export function normalizePhone(phone: string): string {
  const phoneNumber = parsePhoneNumberFromString(phone);
  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new BadRequestException(
      `"${phone}" is not a valid phone number. Provide a phone in international E.164 format (e.g. +34600000000).`,
    );
  }
  return phoneNumber.format('E.164');
}

/**
 * Normalises a document identifier (national ID or passport) to uppercase
 * and trimmed for consistent storage and lookups.
 */
export function normalizeDocumentId(id: string): string {
  return id.toUpperCase().trim();
}

/**
 * Trims whitespace from a string value. Compatible with class-transformer's
 * `@Transform` decorator : accepts `TransformFnParams` and extracts `.value`.
 * Returns undefined when the value is undefined so it can be used safely on
 * optional fields.
 */
export function trim(params: { value?: string }): string | undefined {
  return params.value?.trim();
}
