import { BadRequestException } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserValidationPipe } from './update-user-validation.pipe';

describe('UpdateUserValidationPipe', () => {
  const pipe = new UpdateUserValidationPipe();

  describe('basic fields pass through', () => {
    it('allows non-sensitive fields without current_password', () => {
      const dto: UpdateUserDto = { name: 'Jane' };
      const result = pipe.transform(dto);
      expect(result).toEqual({ name: 'Jane' });
    });

    it('allows all non-sensitive fields', () => {
      const dto: UpdateUserDto = {
        name: 'Jane',
        last_name: 'Doe',
        country: 'Spain',
        national_id: '12345678A',
        passport: 'AB123456',
      };
      const result = pipe.transform(dto);
      expect(result).toEqual(dto);
    });
  });

  describe('sensitive field validation', () => {
    it('throws BadRequestException when changing email without current_password', () => {
      expect(() => pipe.transform({ email: 'new@example.com' })).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when changing phone without current_password', () => {
      expect(() => pipe.transform({ phone_number: '+34600000001' })).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when changing password via new_password without current_password', () => {
      expect(() => pipe.transform({ new_password: 'newPass123' })).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when changing password via legacy password field without current_password', () => {
      expect(() => pipe.transform({ password: 'newLegacyPass' })).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when new_password has no confirm_new_password', () => {
      const dto: UpdateUserDto = {
        new_password: 'newPass123',
        current_password: 'currentPass',
      };
      expect(() => pipe.transform(dto)).toThrow(BadRequestException);
    });

    it('throws BadRequestException when new_password and confirm_new_password do not match', () => {
      const dto: UpdateUserDto = {
        new_password: 'newPass123',
        confirm_new_password: 'differentPass',
        current_password: 'currentPass',
      };
      expect(() => pipe.transform(dto)).toThrow(BadRequestException);
    });
  });

  describe('transformation', () => {
    it('maps new_password to password field', () => {
      const dto: UpdateUserDto = {
        new_password: 'newPass123',
        confirm_new_password: 'newPass123',
        current_password: 'currentPass',
      };
      const result = pipe.transform(dto);
      expect(result.password).toBe('newPass123');
    });

    it('strips new_password and confirm_new_password from the output', () => {
      const dto: UpdateUserDto = {
        name: 'Jane',
        new_password: 'newPass123',
        confirm_new_password: 'newPass123',
        current_password: 'currentPass',
      };
      const result = pipe.transform(dto);
      expect(result).not.toHaveProperty('new_password');
      expect(result).not.toHaveProperty('confirm_new_password');
    });

    it('keeps current_password in the output for controller to verify', () => {
      const dto: UpdateUserDto = {
        phone_number: '+34600000001',
        current_password: 'currentPass',
      };
      const result = pipe.transform(dto);
      expect(result.current_password).toBe('currentPass');
    });

    it('keeps email in the output for controller to handle', () => {
      const dto: UpdateUserDto = {
        email: 'new@example.com',
        current_password: 'currentPass',
      };
      const result = pipe.transform(dto);
      expect(result.email).toBe('new@example.com');
      expect(result).not.toHaveProperty('new_password');
      expect(result).not.toHaveProperty('confirm_new_password');
    });

    it('preserves existing password field when new_password is not set and current_password is provided', () => {
      const dto: UpdateUserDto = {
        password: 'plainOldPassword',
        current_password: 'myCurrentPass',
      };
      const result = pipe.transform(dto);
      expect(result.password).toBe('plainOldPassword');
    });
  });
});
