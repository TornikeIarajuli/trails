import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isMissingRelationError, throwIfError } from './supabase-error';
import { stableStringify, TtlCache } from './ttl-cache';

describe('throwIfError', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  const thrownBy = (error: Parameters<typeof throwIfError>[0]) => {
    try {
      throwIfError(error);
    } catch (e) {
      return e as { message: string; getStatus(): number };
    }
    throw new Error('throwIfError did not throw');
  };

  it('does nothing when error is null', () => {
    expect(() => throwIfError(null)).not.toThrow();
  });

  it('throws a generic InternalServerErrorException for unknown codes', () => {
    const secret = 'relation "private_table" does not exist';
    expect(() => throwIfError({ message: secret })).toThrow(
      InternalServerErrorException,
    );
    expect(thrownBy({ message: secret }).message).toBe('Internal server error');
  });

  it('logs the real message of an unknown error', () => {
    thrownBy({ code: 'XX000', message: 'disk on fire', details: 'sector 7' });

    expect(errorLog).toHaveBeenCalledTimes(1);
    const logged = String(errorLog.mock.calls[0][0]);
    expect(logged).toContain('XX000');
    expect(logged).toContain('disk on fire');
    expect(logged).toContain('sector 7');
  });

  it('throws NotFoundException for PGRST116', () => {
    expect(() => throwIfError({ code: 'PGRST116' })).toThrow(NotFoundException);
    expect(() => throwIfError({ code: 'PGRST116' })).toThrow(
      'Resource not found',
    );
  });

  it('throws ConflictException for unique_violation (23505)', () => {
    expect(() =>
      throwIfError({ code: '23505', message: 'duplicate key' }),
    ).toThrow(ConflictException);
  });

  it('throws BadRequestException for foreign_key_violation (23503)', () => {
    expect(() => throwIfError({ code: '23503', message: 'fk error' })).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException for check_violation (23514)', () => {
    expect(() =>
      throwIfError({ code: '23514', message: 'check failed' }),
    ).toThrow(BadRequestException);
  });

  it.each([
    ['22P02', 'invalid input syntax for type uuid: "abc"'],
    ['22007', 'invalid input syntax for type timestamp'],
    ['22003', 'value out of range for type integer'],
    ['PGRST103', 'Requested range not satisfiable'],
  ])('maps %s to a 400', (code, message) => {
    const error = thrownBy({ code, message });
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
  });

  it.each(['23505', '23503', '23514', '22P02', '22007', '22003'])(
    'never forwards the database message for %s',
    (code) => {
      const dbMessage =
        'violates constraint "profiles_secret_key" Key (email)=(a@b.c)';
      expect(thrownBy({ code, message: dbMessage }).message).not.toContain(
        'profiles_secret_key',
      );
    },
  );
});

describe('isMissingRelationError', () => {
  it.each(['42P01', '42703', 'PGRST204', 'PGRST205'])(
    'recognises %s',
    (code) => {
      expect(isMissingRelationError({ code })).toBe(true);
    },
  );

  it('is false for other errors and for no error', () => {
    expect(isMissingRelationError({ code: '23505' })).toBe(false);
    expect(isMissingRelationError({ message: 'boom' })).toBe(false);
    expect(isMissingRelationError(null)).toBe(false);
    expect(isMissingRelationError(undefined)).toBe(false);
  });
});

describe('TtlCache', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a stored value until it expires', () => {
    jest.useFakeTimers();
    const cache = new TtlCache<number>();
    cache.set('a', 1, 1000);

    expect(cache.get('a')).toBe(1);
    jest.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('never grows beyond maxEntries and evicts the oldest entry first', () => {
    const cache = new TtlCache<number>(3);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('c', 3, 60_000);
    cache.set('d', 4, 60_000);

    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('d')).toBe(4);
  });

  it('treats a re-set key as the newest entry', () => {
    const cache = new TtlCache<number>(2);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('a', 10, 60_000);
    cache.set('c', 3, 60_000);

    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('sweeps expired entries before evicting live ones', () => {
    jest.useFakeTimers();
    const cache = new TtlCache<number>(3);
    cache.set('short', 1, 100);
    cache.set('long-1', 2, 60_000);
    cache.set('long-2', 3, 60_000);
    jest.advanceTimersByTime(500);

    cache.set('new', 4, 60_000);

    expect(cache.size).toBe(3);
    expect(cache.get('long-1')).toBe(2);
    expect(cache.get('long-2')).toBe(3);
    expect(cache.get('new')).toBe(4);
  });

  it('sweeps expired entries periodically even when it is not full', () => {
    jest.useFakeTimers();
    const cache = new TtlCache<number>(100);
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    jest.advanceTimersByTime(61_000);

    cache.set('c', 3, 1000);

    expect(cache.size).toBe(1);
  });

  it('stays bounded under many distinct keys', () => {
    const cache = new TtlCache<number>(50);
    for (let i = 0; i < 10_000; i++) cache.set(`key-${i}`, i, 60_000);

    expect(cache.size).toBe(50);
    expect(cache.get('key-9999')).toBe(9999);
  });

  it('deleteByPrefix removes only matching keys', () => {
    const cache = new TtlCache<number>();
    cache.set('trails:list:a', 1, 60_000);
    cache.set('trails:list:b', 2, 60_000);
    cache.set('trails:detail:x', 3, 60_000);

    cache.deleteByPrefix('trails:list:');

    expect(cache.size).toBe(1);
    expect(cache.get('trails:detail:x')).toBe(3);
  });
});

describe('stableStringify', () => {
  it('produces the same string regardless of key order', () => {
    const a = { difficulty: 'hard', page: 1, region: 'Svaneti' };
    const b = { region: 'Svaneti', difficulty: 'hard', page: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('handles nested objects', () => {
    const a = { z: { b: 1, a: 2 }, y: 3 };
    const b = { y: 3, z: { a: 2, b: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('handles arrays (order-sensitive)', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('handles null and undefined', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('undefined');
  });

  it('handles primitive values', () => {
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(true)).toBe('true');
  });
});
