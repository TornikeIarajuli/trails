import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { PassThrough } from 'stream';
import type { Request } from 'express';
import { MAX_CAPTION_LENGTH, parseCaption, readUploadBody } from './upload';
import { sniffMediaType } from './sniff';

/** A request stream with the given headers and a fake Express response. */
function fakeRequest(headers: Record<string, string> = {}) {
  const stream = new PassThrough();
  const setHeader = jest.fn();
  Object.assign(stream, {
    headers,
    res: { headersSent: false, setHeader },
  });
  return { req: stream as unknown as Request, stream, setHeader };
}

describe('readUploadBody', () => {
  it('returns the whole body', async () => {
    const { req, stream } = fakeRequest();
    const reading = readUploadBody(req, 100);
    stream.write(Buffer.from('hello '));
    stream.end(Buffer.from('world'));

    await expect(reading).resolves.toEqual(Buffer.from('hello world'));
  });

  it('rejects at once when Content-Length is over the limit, without reading', async () => {
    const { req, stream, setHeader } = fakeRequest({ 'content-length': '101' });

    await expect(readUploadBody(req, 100)).rejects.toThrow(
      PayloadTooLargeException,
    );
    expect(stream.listenerCount('data')).toBe(0);
    expect(setHeader).toHaveBeenCalledWith('Connection', 'close');
  });

  it('stops reading as soon as the received bytes pass the limit', async () => {
    const { req, stream } = fakeRequest();
    const reading = readUploadBody(req, 10);

    stream.write(Buffer.alloc(6));
    stream.write(Buffer.alloc(6));

    await expect(reading).rejects.toThrow(PayloadTooLargeException);
    expect(stream.listenerCount('data')).toBe(0);
    expect(stream.isPaused()).toBe(true);
  });

  it('accepts a body of exactly the limit', async () => {
    const { req, stream } = fakeRequest({ 'content-length': '10' });
    const reading = readUploadBody(req, 10);
    stream.end(Buffer.alloc(10));

    await expect(reading).resolves.toHaveLength(10);
  });

  it('counts bytes when the client lies about Content-Length', async () => {
    const { req, stream } = fakeRequest({ 'content-length': '5' });
    const reading = readUploadBody(req, 10);
    stream.write(Buffer.alloc(11));

    await expect(reading).rejects.toThrow(PayloadTooLargeException);
  });

  it('fails when the client disconnects mid-upload', async () => {
    const { req, stream } = fakeRequest();
    const reading = readUploadBody(req, 100);
    stream.write(Buffer.alloc(5));
    stream.destroy();

    await expect(reading).rejects.toThrow(BadRequestException);
  });

  it('returns an empty body when the stream was already consumed', async () => {
    const { req, stream } = fakeRequest();
    stream.end();
    stream.resume();
    await new Promise((resolve) => stream.once('end', resolve));

    await expect(readUploadBody(req, 100)).resolves.toHaveLength(0);
  });

  it('defaults to MAX_UPLOAD_MB (12 MB)', async () => {
    const original = process.env.MAX_UPLOAD_MB;
    delete process.env.MAX_UPLOAD_MB;
    try {
      const over = fakeRequest({
        'content-length': String(12 * 1024 * 1024 + 1),
      });
      await expect(readUploadBody(over.req)).rejects.toThrow(
        PayloadTooLargeException,
      );

      process.env.MAX_UPLOAD_MB = '20';
      const allowed = fakeRequest({
        'content-length': String(13 * 1024 * 1024),
      });
      const reading = readUploadBody(allowed.req);
      allowed.stream.end(Buffer.alloc(1));
      await expect(reading).resolves.toHaveLength(1);
    } finally {
      if (original === undefined) delete process.env.MAX_UPLOAD_MB;
      else process.env.MAX_UPLOAD_MB = original;
    }
  });
});

describe('parseCaption', () => {
  it('decodes a URI-encoded caption', () => {
    expect(parseCaption(encodeURIComponent('მთა & ტბა 🏔️'))).toBe(
      'მთა & ტბა 🏔️',
    );
  });

  it('keeps a caption from older builds that is not encoded', () => {
    expect(parseCaption('100% worth it')).toBe('100% worth it');
    expect(parseCaption('Summit view')).toBe('Summit view');
  });

  it('is null when there is no caption', () => {
    expect(parseCaption(undefined)).toBeNull();
    expect(parseCaption('')).toBeNull();
    expect(parseCaption('%20%20')).toBeNull();
  });

  it('uses the first value of a repeated header', () => {
    expect(parseCaption(['first', 'second'])).toBe('first');
  });

  it(`allows ${MAX_CAPTION_LENGTH} characters and rejects more`, () => {
    const max = 'ა'.repeat(MAX_CAPTION_LENGTH);
    expect(parseCaption(encodeURIComponent(max))).toBe(max);
    expect(() => parseCaption(encodeURIComponent(`${max}ა`))).toThrow(
      BadRequestException,
    );
  });
});

describe('sniffMediaType', () => {
  const bytes = (...values: Array<number | string>) =>
    Buffer.concat(
      values.map((v) =>
        typeof v === 'string' ? Buffer.from(v, 'latin1') : Buffer.from([v]),
      ),
    );
  const ftyp = (brand: string) =>
    bytes(0, 0, 0, 0x18, 'ftyp', brand, 0, 0, 0, 0);

  it.each([
    ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10), 'jpg', 'image/jpeg'],
    [
      'PNG',
      bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0),
      'png',
      'image/png',
    ],
    ['WebP', bytes('RIFF', 0, 0, 0, 0, 'WEBP', 'VP8 '), 'webp', 'image/webp'],
    ['HEIC', ftyp('heic'), 'heic', 'image/heic'],
    ['HEIC (heix)', ftyp('heix'), 'heic', 'image/heic'],
    ['HEIF', ftyp('mif1'), 'heif', 'image/heif'],
    ['MP4', ftyp('isom'), 'mp4', 'video/mp4'],
    ['MP4 (mp42)', ftyp('mp42'), 'mp4', 'video/mp4'],
    ['MOV', ftyp('qt  '), 'mov', 'video/quicktime'],
  ])('recognises %s', (_label, buf, ext, contentType) => {
    expect(sniffMediaType(buf)).toMatchObject({ ext, contentType });
  });

  it.each([
    ['an empty file', Buffer.alloc(0)],
    ['a GIF', bytes('GIF89a', 0, 0)],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['HTML', Buffer.from('<!DOCTYPE html><script>alert(1)</script>')],
    ['a PDF', Buffer.from('%PDF-1.7')],
    ['a RIFF file that is not WebP', bytes('RIFF', 0, 0, 0, 0, 'WAVE')],
    ['AVIF', ftyp('avif')],
    ['a truncated JPEG', bytes(0xff, 0xd8)],
  ])('rejects %s', (_label, buf) => {
    expect(sniffMediaType(buf)).toBeNull();
  });
});
