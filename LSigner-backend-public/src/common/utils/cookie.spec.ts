import { extractCookieValue } from './cookie';

describe('extractCookieValue', () => {
  it('returns the value for the matching cookie name', () => {
    const cookieHeader = 'ls_public_session=abc123; theme=dark';
    const result = extractCookieValue(cookieHeader, 'ls_public_session');
    expect(result).toBe('abc123');
  });

  it('returns null when cookie header is undefined', () => {
    const result = extractCookieValue(undefined, 'ls_public_session');
    expect(result).toBeNull();
  });

  it('returns null when cookie header is empty', () => {
    const result = extractCookieValue('', 'ls_public_session');
    expect(result).toBeNull();
  });

  it('returns null when cookie name is not found', () => {
    const cookieHeader = 'theme=dark';
    const result = extractCookieValue(cookieHeader, 'ls_public_session');
    expect(result).toBeNull();
  });

  it('decodes URI-encoded cookie values', () => {
    const cookieHeader =
      'ls_public_session=eyJ0eXAiOiJKV1QifQ%3D%3D; theme=dark';
    const result = extractCookieValue(cookieHeader, 'ls_public_session');
    expect(result).toBe('eyJ0eXAiOiJKV1QifQ==');
  });

  it('handles cookie values containing equals signs', () => {
    const cookieHeader = 'token=abc=def=ghi; other=val';
    const result = extractCookieValue(cookieHeader, 'token');
    expect(result).toBe('abc=def=ghi');
  });

  it('matches exact cookie name (not prefix)', () => {
    const cookieHeader =
      'ls_public_session_extended=foo; ls_public_session=bar';
    const result = extractCookieValue(cookieHeader, 'ls_public_session');
    expect(result).toBe('bar');
  });
});
