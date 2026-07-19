/**
 * Shared regex patterns used across pipes and validators.
 *
 * NATIONAL_ID  : 1-50 alphanumeric chars, optionally separated by hyphens
 *                (no consecutive hyphens; e.g. "12345678A", "123-45-6789").
 *
 * PASSPORT     : 6-20 alphanumeric chars, optionally separated by a single
 *                hyphen (e.g. "AB123456", "AB-123456").
 *
 * PHONE_E164   : E.164 international format: + followed by 7-15 digits
 *                (e.g. "+34600000000", "+12125559999").
 *                Use this as a fallback only; prefer isMobilePhone('any').
 */

export const NATIONAL_ID_REGEX =
  /^(?=[A-Za-z0-9-]{1,50}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

export const PASSPORT_REGEX =
  /^(?=(?:[A-Za-z0-9]-?){6,20}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?$/;

export const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;
