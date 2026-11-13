// Polite HTTP client shared by the content pipeline: one generic User-Agent,
// per-host spacing between requests, disk cache, retries with back-off.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, ensureDir } from './paths.mjs';

export const USER_AGENT = 'TrailContentTool/1.0 (hiking app content preparation)';

const lastCallAt = new Map();
const chains = new Map();

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Serialises calls per key and keeps at least `minIntervalMs` between them. */
export function throttle(key, minIntervalMs, fn) {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev
    .catch(() => {})
    .then(async () => {
      const wait = (lastCallAt.get(key) ?? 0) + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } finally {
        lastCallAt.set(key, Date.now());
      }
    });
  chains.set(key, run);
  return run;
}

export function cachePath(bucket, key, ext = 'json') {
  const hash = crypto.createHash('sha1').update(key).digest('hex');
  return path.join(CACHE, bucket, `${hash}.${ext}`);
}

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} for ${url}${body ? `: ${String(body).slice(0, 200)}` : ''}`);
    this.status = status;
  }
}

/**
 * GET/POST with cache. Options:
 *  bucket        cache sub-folder (omit to disable caching)
 *  cacheKey      defaults to method + url + body
 *  minIntervalMs spacing per host
 *  retries, timeoutMs, retryOn (statuses), as ('json' | 'text' | 'buffer')
 *  validate      throws to reject a 200 response (it is then retried and never cached)
 */
export async function request(url, opts = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    bucket,
    cacheKey,
    minIntervalMs = 250,
    retries = 4,
    timeoutMs = 120_000,
    retryOn = [429, 500, 502, 503, 504],
    as = 'json',
    refresh = false,
    throttleKey,
    validate,
  } = opts;

  const ext = as === 'buffer' ? 'bin' : as === 'text' ? 'txt' : 'json';
  const file = bucket ? cachePath(bucket, cacheKey ?? `${method} ${url} ${body ?? ''}`, ext) : null;
  if (file && !refresh && fs.existsSync(file)) {
    const raw = fs.readFileSync(file);
    if (as === 'buffer') return raw;
    return as === 'json' ? JSON.parse(raw.toString('utf8')) : raw.toString('utf8');
  }

  const host = throttleKey ?? new URL(url).host;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await throttle(host, minIntervalMs, () =>
        fetch(url, {
          method,
          body,
          headers: { 'User-Agent': USER_AGENT, Accept: as === 'json' ? 'application/json' : '*/*', ...headers },
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new HttpError(res.status, url, text);
        if (!retryOn.includes(res.status)) throw Object.assign(err, { fatal: true });
        const retryAfter = Number(res.headers.get('retry-after'));
        err.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null;
        throw err;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      let value;
      if (as === 'buffer') value = buf;
      else if (as === 'text') value = buf.toString('utf8');
      else value = JSON.parse(buf.toString('utf8'));
      if (validate) validate(value);
      if (file) {
        ensureDir(path.dirname(file));
        fs.writeFileSync(file, buf);
      }
      return value;
    } catch (err) {
      lastError = err;
      if (err.fatal || attempt === retries) break;
      const backoff = err.retryAfterMs ?? Math.min(90_000, 4000 * 2 ** attempt);
      process.stderr.write(`  retry ${attempt + 1}/${retries} in ${Math.round(backoff / 1000)}s — ${err.message.slice(0, 140)}\n`);
      await sleep(backoff);
    }
  }
  throw lastError;
}
