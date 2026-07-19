import { OtpAuthContext } from './otp-auth-context.enum';

describe('OtpAuthContext', () => {
  it('has a JWT value equal to "JWT"', () => {
    expect(OtpAuthContext.JWT).toBe('JWT');
  });

  it('has a PUBLIC_SESSION value equal to "PUBLIC_SESSION"', () => {
    expect(OtpAuthContext.PUBLIC_SESSION).toBe('PUBLIC_SESSION');
  });
});
