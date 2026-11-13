import { Reflector } from '@nestjs/core';
import { ProxyThrottlerGuard, resolveClientIp } from './proxy-throttler.guard';

const request = (headers: Record<string, unknown>, ip = '10.0.0.7') => ({
  headers,
  ip,
});

describe('resolveClientIp', () => {
  it('uses the configured edge header when it holds a valid IPv4 address', () => {
    const req = request({ 'cf-connecting-ip': '203.0.113.9' });
    expect(resolveClientIp(req, 'cf-connecting-ip')).toBe('203.0.113.9');
  });

  it('accepts IPv6 addresses', () => {
    const req = request({ 'cf-connecting-ip': '2001:db8::1' });
    expect(resolveClientIp(req, 'cf-connecting-ip')).toBe('2001:db8::1');
  });

  it('matches the header name case-insensitively and trims the value', () => {
    const req = request({ 'cf-connecting-ip': '  203.0.113.9 ' });
    expect(resolveClientIp(req, ' CF-Connecting-IP ')).toBe('203.0.113.9');
  });

  it('defaults to cf-connecting-ip when no header name is configured', () => {
    const req = request({ 'cf-connecting-ip': '203.0.113.9' });
    expect(resolveClientIp(req, undefined)).toBe('203.0.113.9');
    expect(resolveClientIp(req, '')).toBe('203.0.113.9');
  });

  it('never trusts X-Forwarded-For, whatever the client puts in it', () => {
    const spoofed = request({ 'x-forwarded-for': '1.2.3.4' });
    expect(resolveClientIp(spoofed, 'cf-connecting-ip')).toBe('10.0.0.7');
    expect(resolveClientIp(spoofed, 'x-forwarded-for')).toBe('10.0.0.7');
    expect(resolveClientIp(spoofed, undefined)).toBe('10.0.0.7');
  });

  it('gives two requests with different spoofed X-Forwarded-For the same key', () => {
    const a = resolveClientIp(request({ 'x-forwarded-for': '1.1.1.1' }));
    const b = resolveClientIp(request({ 'x-forwarded-for': '2.2.2.2' }));
    expect(a).toBe(b);
  });

  it.each([
    ['not an address', 'definitely-not-an-ip'],
    ['a list of addresses', '203.0.113.9, 198.51.100.4'],
    ['an address with a port', '203.0.113.9:443'],
    ['an empty value', ''],
    ['an injected key', '203.0.113.9\nx: y'],
  ])('falls back to req.ip when the header holds %s', (_label, value) => {
    const req = request({ 'cf-connecting-ip': value });
    expect(resolveClientIp(req, 'cf-connecting-ip')).toBe('10.0.0.7');
  });

  it('falls back to req.ip when the header is repeated', () => {
    const req = request({
      'cf-connecting-ip': ['203.0.113.9', '198.51.100.4'],
    });
    expect(resolveClientIp(req, 'cf-connecting-ip')).toBe('10.0.0.7');
  });

  it('ignores every header when set to "none"', () => {
    const req = request({ 'cf-connecting-ip': '203.0.113.9' });
    expect(resolveClientIp(req, 'none')).toBe('10.0.0.7');
    expect(resolveClientIp(req, 'NONE')).toBe('10.0.0.7');
  });

  it('honours a custom header name', () => {
    const req = request({
      'cf-connecting-ip': '203.0.113.9',
      'fly-client-ip': '198.51.100.4',
    });
    expect(resolveClientIp(req, 'fly-client-ip')).toBe('198.51.100.4');
  });

  it('falls back to the socket address, then to a constant', () => {
    expect(
      resolveClientIp(
        { headers: {}, socket: { remoteAddress: '192.0.2.1' } },
        'none',
      ),
    ).toBe('192.0.2.1');
    expect(resolveClientIp({ headers: {} }, 'none')).toBe('unknown');
    expect(resolveClientIp({}, 'cf-connecting-ip')).toBe('unknown');
  });
});

describe('ProxyThrottlerGuard', () => {
  const original = process.env.CLIENT_IP_HEADER;

  afterEach(() => {
    if (original === undefined) delete process.env.CLIENT_IP_HEADER;
    else process.env.CLIENT_IP_HEADER = original;
  });

  const tracker = (req: Record<string, unknown>): Promise<string> => {
    const guard = new ProxyThrottlerGuard(
      [{ ttl: 60000, limit: 60 }],
      {} as never,
      new Reflector(),
    );
    return (
      guard as unknown as { getTracker(r: unknown): Promise<string> }
    ).getTracker(req);
  };

  it('tracks by the edge header by default', async () => {
    delete process.env.CLIENT_IP_HEADER;
    const req = request({
      'cf-connecting-ip': '203.0.113.9',
      'x-forwarded-for': '6.6.6.6',
    });
    await expect(tracker(req)).resolves.toBe('203.0.113.9');
  });

  it('reads CLIENT_IP_HEADER from the environment', async () => {
    process.env.CLIENT_IP_HEADER = 'none';
    const req = request({ 'cf-connecting-ip': '203.0.113.9' });
    await expect(tracker(req)).resolves.toBe('10.0.0.7');
  });
});
