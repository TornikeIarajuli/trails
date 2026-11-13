// Validation helpers for files the admin uploads. Pure functions: also used in the browser
// for an early size check, and covered by tests/uploads.test.mjs.

// Vercel rejects function request bodies above 4.5 MB, so a file sent through a server
// action has to stay below that (the storage buckets themselves accept up to 12 MB).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function uploadSizeError(size: number): string | null {
  if (size <= 0) return "The file is empty.";
  if (size > MAX_UPLOAD_BYTES) {
    return `The file is too large (${(size / (1024 * 1024)).toFixed(1)} MB). The admin panel accepts files up to 4 MB.`;
  }
  return null;
}

export interface ImageKind {
  ext: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

export const IMAGE_TYPE_ERROR = "Unsupported image type. Upload a JPEG, PNG or WebP file.";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

// The type comes from the file's leading bytes, never from the name or content type the
// browser sent. Only formats every phone and browser can display are accepted.
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", contentType: "image/jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: "png", contentType: "image/png" };
  }
  // "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export type GpxResult =
  | { ok: true; coords: [number, number][] } // [lng, lat], GeoJSON order
  | { ok: false; error: string };

const TRKPT_RE = /<trkpt\b[^>]*>/gi;
const LAT_RE = /\slat\s*=\s*(["'])(.*?)\1/i;
const LON_RE = /\slon\s*=\s*(["'])(.*?)\1/i;

function coordinate(raw: string | undefined, limit: number): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

export function parseGpxTrack(text: string): GpxResult {
  if (text.includes("\u0000") || !/<gpx[\s>]/i.test(text)) {
    return { ok: false, error: "This is not a GPX file. Upload the .gpx export of a recorded track." };
  }

  const coords: [number, number][] = [];
  let index = 0;
  for (const tag of text.match(TRKPT_RE) ?? []) {
    index++;
    const lat = coordinate(LAT_RE.exec(tag)?.[2], 90);
    const lon = coordinate(LON_RE.exec(tag)?.[2], 180);
    if (lat === null || lon === null) {
      return {
        ok: false,
        error: `Track point ${index} has a missing or out-of-range latitude/longitude. Nothing was imported.`,
      };
    }
    coords.push([lon, lat]);
  }

  if (coords.length < 2) {
    return {
      ok: false,
      error: "No valid track points found. Make sure the file is a valid GPX with a <trkseg>.",
    };
  }
  return { ok: true, coords };
}

// Keeps at most `max` points, always including the first and the last one.
export function subsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const sampled = points.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
}

// Maps a public storage URL back to the object's path inside `bucket`, or null when the URL
// does not point into that bucket of this Supabase project (e.g. an externally hosted photo).
export function storageObjectPath(
  publicUrl: string,
  supabaseUrl: string | undefined,
  bucket: string,
): string | null {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(publicUrl);
    if (url.origin !== new URL(supabaseUrl).origin) return null;
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return path && !path.split("/").includes("..") ? path : null;
  } catch {
    return null;
  }
}
