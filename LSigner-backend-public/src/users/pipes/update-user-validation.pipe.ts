import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';

// TODO: Investigate if this can be improved while keeping indemp
@Injectable()
export class UpdateUserValidationPipe implements PipeTransform<
  UpdateUserDto,
  UpdateUserDto
> {
  transform(dto: UpdateUserDto): UpdateUserDto {
    const hasSensitiveChange = !!(
      dto.email ||
      dto.phone_number ||
      dto.new_password ||
      dto.password
    );

    if (hasSensitiveChange && !dto.current_password) {
      throw new BadRequestException(
        'current_password is required to change email, phone, or password',
      );
    }

    if (dto.new_password && !dto.confirm_new_password) {
      throw new BadRequestException(
        'confirm_new_password is required when setting a new password',
      );
    }

    if (dto.new_password && dto.new_password !== dto.confirm_new_password) {
      throw new BadRequestException(
        'New password and confirmation do not match',
      );
    }

    const {
      new_password: _np,
      confirm_new_password: _cnp,
      ...cleanedDto
    } = dto;

    if (_np) {
      cleanedDto.password = _np;
    }

    return cleanedDto;
  }
}
