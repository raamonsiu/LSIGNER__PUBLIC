import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { UserSearchResultDto } from './dto/user-search-result.dto';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PATIENT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

/**
 * Creates a minimal user object with only the fields returned by the search
 * projection (patient_id, name, last_name, email). The service's `select`
 * clause guarantees these are the only fields loaded from the DB.
 */
function makeRawSearchResult(
  overrides: Partial<
    Pick<User, 'patient_id' | 'name' | 'last_name' | 'email'>
  > = {},
): Partial<User> {
  return {
    patient_id: PATIENT_ID,
    name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    ...overrides,
  };
}

/** Expected DTO after the service maps patient_id -> id. */
function makeSearchResultDto(
  overrides: Partial<UserSearchResultDto> = {},
): UserSearchResultDto {
  return {
    id: PATIENT_ID,
    name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('UsersService.search', () => {
  let service: UsersService;
  let em: {
    find: jest.Mock;
  };

  beforeEach(async () => {
    em = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: EntityManager, useValue: em }],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns users matching the query on name using ILIKE', async () => {
    const rawUsers = [makeRawSearchResult()];
    em.find.mockResolvedValueOnce(rawUsers);

    const result = await service.search('ali', em as unknown as EntityManager);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(makeSearchResultDto());
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('patient_id');
    expect(result[0]).not.toHaveProperty('phone_number');
    expect(result[0]).not.toHaveProperty('national_id');
    expect(result[0]).not.toHaveProperty('passport');
    expect(result[0]).not.toHaveProperty('password');
    expect(result[0]).not.toHaveProperty('salt');
  });

  it('returns users matching the query on email using ILIKE', async () => {
    const rawUsers = [makeRawSearchResult()];
    em.find.mockResolvedValueOnce(rawUsers);

    const result = await service.search(
      'alice@example',
      em as unknown as EntityManager,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(PATIENT_ID);
    expect(em.find).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        select: ['patient_id', 'name', 'last_name', 'email'],
        take: 20,
      }),
    );
  });

  it('returns users matching the query on last_name using ILIKE', async () => {
    const rawUsers = [makeRawSearchResult()];
    em.find.mockResolvedValueOnce(rawUsers);

    const result = await service.search(
      'smith',
      em as unknown as EntityManager,
    );

    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('Smith');
  });

  it('returns empty array when no users match the query', async () => {
    em.find.mockResolvedValueOnce([]);

    const result = await service.search(
      'noone',
      em as unknown as EntityManager,
    );

    expect(result).toEqual([]);
  });

  it('returns empty array for an empty query string', async () => {
    em.find.mockResolvedValueOnce([]);

    const result = await service.search('', em as unknown as EntityManager);

    expect(result).toEqual([]);
  });

  it('limits results to 20 users', async () => {
    const rawUsers = Array.from({ length: 25 }, (_, i) =>
      makeRawSearchResult({
        patient_id: `id-${i}`,
        email: `user${i}@example.com`,
      }),
    );
    em.find.mockResolvedValueOnce(rawUsers.slice(0, 20));

    const result = await service.search('user', em as unknown as EntityManager);

    expect(result).toHaveLength(20);
    expect(em.find).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        take: 20,
      }),
    );
  });

  it('falls back to default EntityManager when transactionalEntityManager is not provided', async () => {
    em.find.mockResolvedValueOnce([makeRawSearchResult()]);

    await service.search('alice');

    expect(em.find).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        select: ['patient_id', 'name', 'last_name', 'email'],
      }),
    );
  });
});
