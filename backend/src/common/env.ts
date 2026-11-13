import { Logger } from '@nestjs/common';

const logger = new Logger('Env');
const warned = new Set<string>();

interface NumberRange {
  min?: number;
  max?: number;
  integer?: boolean;
}

/**
 * Reads an optional numeric environment variable. An unset or empty variable yields the
 * default; so does a value that is not a number or is out of range (with one warning),
 * because a typo in an optional setting must not take the API down.
 */
export function envNumber(
  name: string,
  fallback: number,
  { min, max, integer }: NumberRange = {},
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  const valid =
    Number.isFinite(value) &&
    (!integer || Number.isInteger(value)) &&
    (min === undefined || value >= min) &&
    (max === undefined || value <= max);
  if (valid) return value;

  if (!warned.has(name)) {
    warned.add(name);
    logger.warn(`Ignoring invalid ${name}; using the default (${fallback})`);
  }
  return fallback;
}

/** Reverse proxies in front of the app that Express trusts when deriving req.ip. */
export function trustProxyHops(): number {
  return envNumber('TRUST_PROXY_HOPS', 1, { min: 0, max: 10, integer: true });
}

/** Largest accepted upload, in bytes. */
export function maxUploadBytes(): number {
  const megabytes = envNumber('MAX_UPLOAD_MB', 12, { min: 1, max: 100 });
  return Math.floor(megabytes * 1024 * 1024);
}
