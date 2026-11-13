import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'net';

const DEFAULT_CLIENT_IP_HEADER = 'cf-connecting-ip';

/**
 * The address a request is rate-limited by.
 *
 * `headerName` must name a header that the edge in front of this server sets itself and
 * that a client cannot forge (Cloudflare's CF-Connecting-IP, which fronts Render).
 * X-Forwarded-For is not such a header - its leftmost entries are whatever the client
 * sent - so it is never read here. Without a usable header the answer is Express'
 * `req.ip`, which applies the `trust proxy` setting.
 */
export function resolveClientIp(
  req: Record<string, any>,
  headerName: string | undefined = process.env.CLIENT_IP_HEADER,
): string {
  const name = (headerName || DEFAULT_CLIENT_IP_HEADER).trim().toLowerCase();

  if (name && name !== 'none' && name !== 'x-forwarded-for') {
    const value: unknown = req.headers?.[name];
    if (typeof value === 'string') {
      const candidate = value.trim();
      if (isIP(candidate)) return candidate;
    }
  }

  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Throttler keyed on the real client address when the app runs behind a reverse proxy.
 */
@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(resolveClientIp(req));
  }
}
