import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

const logger = new Logger('Supabase');

export interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Wraps a raw Supabase/PostgREST error in the appropriate NestJS exception.
 * Maps common Postgres error codes to proper HTTP status codes. The database's own
 * message (constraint names, column values) is logged, never sent to the client.
 */
export function throwIfError(error: SupabaseErrorLike | null): void {
  if (!error) return;

  switch (error.code) {
    // 23505 = unique_violation
    case '23505':
      throw new ConflictException('This already exists');
    // 23503 = foreign_key_violation
    case '23503':
      throw new BadRequestException('A referenced item does not exist');
    // 23514 = check_violation
    case '23514':
      throw new BadRequestException('A value is not allowed');
    // 22P02 = invalid_text_representation (e.g. a malformed uuid or enum value)
    case '22P02':
      throw new BadRequestException('A value has an invalid format');
    // 22007 = invalid_datetime_format
    case '22007':
      throw new BadRequestException('A date or time has an invalid format');
    // 22003 = numeric_value_out_of_range
    case '22003':
      throw new BadRequestException('A number is out of range');
    // PGRST103 = requested page starts after the last row
    case 'PGRST103':
      throw new BadRequestException('Requested page is out of range');
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    case 'PGRST116':
      throw new NotFoundException('Resource not found');
    default:
      logger.error(
        `Unexpected database error [${error.code ?? 'no code'}]: ${error.message ?? 'no message'}` +
          (error.details ? ` (${error.details})` : ''),
      );
      throw new InternalServerErrorException('Internal server error');
  }
}

/** True when the error says a table or column this code expects is not in the database yet. */
export function isMissingRelationError(
  error: SupabaseErrorLike | null | undefined,
): boolean {
  if (!error) return false;
  // 42P01 undefined_table, 42703 undefined_column (Postgres);
  // PGRST204/PGRST205 column/table not found in PostgREST's schema cache.
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205'
  );
}
