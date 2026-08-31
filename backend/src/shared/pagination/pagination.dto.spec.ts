import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginatedResponse,
  PaginationQueryDto,
} from './pagination.dto';

async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, query);
  return { dto, errors: await validate(dto) };
}

describe('PaginationQueryDto', () => {
  it('applies defaults when nothing is supplied', async () => {
    const { dto, errors } = await parse({});

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(dto.offset).toBe(0);
  });

  it('coerces numeric query strings', async () => {
    const { dto, errors } = await parse({ limit: '50', offset: '100' });

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(100);
  });

  it('caps the page size so a caller cannot request the whole table', async () => {
    const { errors } = await parse({ limit: String(MAX_PAGE_SIZE + 1) });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it.each([['0'], ['-5']])('rejects a limit of %s', async (limit) => {
    const { errors } = await parse({ limit });
    expect(errors).toHaveLength(1);
  });

  it('rejects a negative offset', async () => {
    const { errors } = await parse({ offset: '-1' });
    expect(errors).toHaveLength(1);
  });
});

describe('PaginatedResponse', () => {
  const query = plainToInstance(PaginationQueryDto, { limit: 20, offset: 0 });

  it('reports more pages remain', () => {
    const page = PaginatedResponse.of(new Array(20).fill('x'), 55, query);

    expect(page.total).toBe(55);
    expect(page.hasMore).toBe(true);
  });

  it('reports the final page correctly', () => {
    const last = plainToInstance(PaginationQueryDto, { limit: 20, offset: 40 });
    const page = PaginatedResponse.of(new Array(15).fill('x'), 55, last);

    expect(page.hasMore).toBe(false);
  });

  it('handles an empty result set', () => {
    const page = PaginatedResponse.of([], 0, query);

    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
  });
});
