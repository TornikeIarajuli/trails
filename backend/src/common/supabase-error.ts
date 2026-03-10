import { InternalServerErrorException } from '@nestjs/common';

/**
 * Wraps a raw Supabase/PostgREST error in a NestJS exception.
 * Use instead of `if (error) throw error` to ensure consistent HTTP responses.
 */
export function throwIfError(error: { message?: string; code?: string } | null): void {
  if (!error) return;
  throw new InternalServerErrorException(error.message ?? 'Database operation failed');
}
