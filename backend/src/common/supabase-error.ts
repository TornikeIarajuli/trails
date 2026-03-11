import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Wraps a raw Supabase/PostgREST error in the appropriate NestJS exception.
 * Maps common Postgres error codes to proper HTTP status codes.
 */
export function throwIfError(error: { message?: string; code?: string } | null): void {
  if (!error) return;

  const msg = error.message ?? 'Database operation failed';

  switch (error.code) {
    // 23505 = unique_violation
    case '23505':
      throw new ConflictException(msg);
    // 23503 = foreign_key_violation
    case '23503':
      throw new BadRequestException(msg);
    // 23514 = check_violation
    case '23514':
      throw new BadRequestException(msg);
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    case 'PGRST116':
      throw new NotFoundException('Resource not found');
    default:
      throw new InternalServerErrorException(msg);
  }
}
