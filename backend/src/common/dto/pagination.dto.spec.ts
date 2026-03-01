import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

// Helper: validate a plain object as a PaginationDto
async function check(plain: object) {
  return validate(plainToInstance(PaginationDto, plain));
}

describe('PaginationDto', () => {
  // -------------------------------------------------------------------------
  // page
  // -------------------------------------------------------------------------
  describe('page field', () => {
    it('accepts a valid page number', async () => {
      const errors = await check({ page: 1 });
      expect(errors.filter((e) => e.property === 'page')).toHaveLength(0);
    });

    it('accepts page = 100', async () => {
      const errors = await check({ page: 100 });
      expect(errors.filter((e) => e.property === 'page')).toHaveLength(0);
    });

    it('accepts a page supplied as a string — @Type converts it', async () => {
      const errors = await check({ page: '5' });
      expect(errors.filter((e) => e.property === 'page')).toHaveLength(0);
    });

    it('rejects page = 0 (below @Min(1))', async () => {
      const errors = await check({ page: 0 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('rejects negative page numbers', async () => {
      const errors = await check({ page: -1 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('rejects a non-integer page', async () => {
      const errors = await check({ page: 1.5 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('is optional — omitting it produces no errors', async () => {
      const errors = await check({});
      expect(errors.filter((e) => e.property === 'page')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // limit
  // -------------------------------------------------------------------------
  describe('limit field', () => {
    it('accepts limit = 1 (minimum)', async () => {
      const errors = await check({ limit: 1 });
      expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
    });

    it('accepts limit = 20 (default)', async () => {
      const errors = await check({ limit: 20 });
      expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
    });

    it('accepts limit = 500 (maximum)', async () => {
      const errors = await check({ limit: 500 });
      expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
    });

    it('accepts limit supplied as a string — @Type converts it', async () => {
      const errors = await check({ limit: '200' });
      expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
    });

    it('rejects limit = 501 (exceeds @Max(500))', async () => {
      const errors = await check({ limit: 501 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('rejects limit = 1000', async () => {
      const errors = await check({ limit: 1000 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('rejects limit = 0 (below @Min(1))', async () => {
      const errors = await check({ limit: 0 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('rejects a non-integer limit', async () => {
      const errors = await check({ limit: 10.5 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('is optional — omitting it produces no errors', async () => {
      const errors = await check({});
      expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Combined
  // -------------------------------------------------------------------------
  describe('combined page + limit', () => {
    it('accepts a fully valid DTO', async () => {
      const errors = await check({ page: 3, limit: 50 });
      expect(errors).toHaveLength(0);
    });

    it('accepts an empty object (both fields optional with defaults)', async () => {
      const errors = await check({});
      expect(errors).toHaveLength(0);
    });

    it('can detect errors on both fields at once', async () => {
      const errors = await check({ page: 0, limit: 999 });
      const props = errors.map((e) => e.property);
      expect(props).toContain('page');
      expect(props).toContain('limit');
    });
  });
});
