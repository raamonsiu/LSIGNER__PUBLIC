/**
 * Extracts the value of a named cookie from a Cookie header string.
 * Returns `null` when the header is missing, empty, or the cookie name is not found.
 * URI-decodes the cookie value.
 */
export function extractCookieValue(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookieEntry of cookies) {
    const [rawName, ...valueParts] = cookieEntry.trim().split('=');
    if (rawName === cookieName) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}
