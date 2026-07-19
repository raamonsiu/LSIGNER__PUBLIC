import { ApiProperty } from '@nestjs/swagger';

/**
 * Lightweight projection returned by "GET /users/search?q=".
 * Only exposes the four safe fields : sensitive data (phone, national_id,
 * passport, password) is never included.
 */
export class UserSearchResultDto {
  @ApiProperty({
    description: 'User UUID (patient_id)',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
  })
  id: string;

  @ApiProperty({
    description: 'First name',
    example: 'Alice',
  })
  name: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Smith',
  })
  last_name: string;

  @ApiProperty({
    description: 'Email address',
    example: 'alice@example.com',
  })
  email: string;
}
