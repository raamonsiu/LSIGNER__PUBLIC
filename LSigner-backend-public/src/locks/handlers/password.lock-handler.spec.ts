import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PasswordLockHandler } from './password.lock-handler';

describe('PasswordLockHandler', () => {
  let handler: PasswordLockHandler;

  beforeEach(() => {
    handler = new PasswordLockHandler();
  });

  // ── apply ────────────────────────────────────────────────────────────────────

  describe('apply', () => {
    it('returns a config with hash and salt', async () => {
      const config = await handler.apply({ password: 'secret123' });

      expect(typeof config['hash']).toBe('string');
      expect(typeof config['salt']).toBe('string');
      expect((config['hash'] as string).length).toBe(128); // 64 bytes hex
      expect((config['salt'] as string).length).toBe(64); // 32 bytes hex
    });

    it('produces a different salt on each call (no determinism)', async () => {
      const config1 = await handler.apply({ password: 'secret123' });
      const config2 = await handler.apply({ password: 'secret123' });

      expect(config1['salt']).not.toBe(config2['salt']);
      expect(config1['hash']).not.toBe(config2['hash']);
    });

    it('throws BadRequestException when password is too short', async () => {
      await expect(handler.apply({ password: 'abc' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when password is an empty string', async () => {
      await expect(handler.apply({ password: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── verify ───────────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('resolves when the password matches', async () => {
      const config = await handler.apply({ password: 'correct-password' });
      await expect(
        handler.verify(config, { password: 'correct-password' }),
      ).resolves.toBeUndefined();
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      const config = await handler.apply({ password: 'correct-password' });
      await expect(
        handler.verify(config, { password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no password is provided', async () => {
      const config = await handler.apply({ password: 'secret123' });
      await expect(
        handler.verify(config, { password: undefined as unknown as string }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
