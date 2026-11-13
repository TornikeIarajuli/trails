import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { Request } from 'express';
import { maxUploadBytes } from '../common/env';

export const MAX_CAPTION_LENGTH = 300;

function tooLarge(req: Request, maxBytes: number): PayloadTooLargeException {
  // Stop the client from streaming the rest of an oversized body over this connection.
  if (!req.res?.headersSent) req.res?.setHeader('Connection', 'close');
  const megabytes = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
  return new PayloadTooLargeException(
    `File is too large (max ${megabytes} MB)`,
  );
}

/**
 * Reads a raw upload body, rejecting it with 413 as soon as the declared Content-Length
 * or the bytes actually received exceed `maxBytes` (so a large body is never buffered).
 */
export function readUploadBody(
  req: Request,
  maxBytes: number = maxUploadBytes(),
): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.reject(tooLarge(req, maxBytes));
  }
  // A body parser already consumed the stream (e.g. a JSON Content-Type)
  if (req.readableEnded) return Promise.resolve(Buffer.alloc(0));

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('close', onClose);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      received += buffer.length;
      if (received > maxBytes) {
        cleanup();
        req.pause();
        reject(tooLarge(req, maxBytes));
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, received));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onClose = () => {
      // The client went away before the body was complete
      if (req.readableEnded) return;
      cleanup();
      reject(new BadRequestException('Upload was interrupted'));
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
  });
}

/**
 * The caption sent in the `x-caption` header. New app builds send it URI-encoded so any
 * UTF-8 text survives the header; a value that does not decode is used as sent.
 */
export function parseCaption(
  header: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;

  let caption = raw;
  try {
    caption = decodeURIComponent(raw);
  } catch {
    // released builds send the caption unencoded
  }
  caption = caption.trim();
  if (!caption) return null;

  if ([...caption].length > MAX_CAPTION_LENGTH) {
    throw new BadRequestException(
      `Caption must be at most ${MAX_CAPTION_LENGTH} characters`,
    );
  }
  return caption;
}
