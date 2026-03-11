import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { throwIfError } from './supabase-error';
import { stableStringify } from './ttl-cache';

describe('throwIfError', () => {
  it('does nothing when error is null', () => {
    expect(() => throwIfError(null)).not.toThrow();
  });

  it('throws InternalServerErrorException for unknown codes', () => {
    expect(() => throwIfError({ message: 'row not found' })).toThrow(
      InternalServerErrorException,
    );
    expect(() => throwIfError({ message: 'row not found' })).toThrow(
      'row not found',
    );
  });

  it('throws NotFoundException for PGRST116', () => {
    expect(() => throwIfError({ code: 'PGRST116' })).toThrow(NotFoundException);
    expect(() => throwIfError({ code: 'PGRST116' })).toThrow('Resource not found');
  });

  it('throws ConflictException for unique_violation (23505)', () => {
    expect(() => throwIfError({ code: '23505', message: 'duplicate key' })).toThrow(
      ConflictException,
    );
  });

  it('throws BadRequestException for foreign_key_violation (23503)', () => {
    expect(() => throwIfError({ code: '23503', message: 'fk error' })).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException for check_violation (23514)', () => {
    expect(() => throwIfError({ code: '23514', message: 'check failed' })).toThrow(
      BadRequestException,
    );
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
