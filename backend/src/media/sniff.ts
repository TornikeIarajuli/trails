export interface SniffedType {
  ext: 'jpg' | 'png' | 'webp' | 'heic' | 'heif' | 'mp4' | 'mov';
  contentType: string;
  kind: 'image' | 'video';
}

const JPEG: SniffedType = {
  ext: 'jpg',
  contentType: 'image/jpeg',
  kind: 'image',
};
const PNG: SniffedType = {
  ext: 'png',
  contentType: 'image/png',
  kind: 'image',
};
const WEBP: SniffedType = {
  ext: 'webp',
  contentType: 'image/webp',
  kind: 'image',
};
const HEIC: SniffedType = {
  ext: 'heic',
  contentType: 'image/heic',
  kind: 'image',
};
const HEIF: SniffedType = {
  ext: 'heif',
  contentType: 'image/heif',
  kind: 'image',
};
const MP4: SniffedType = {
  ext: 'mp4',
  contentType: 'video/mp4',
  kind: 'video',
};
const MOV: SniffedType = {
  ext: 'mov',
  contentType: 'video/quicktime',
  kind: 'video',
};

// ISO-BMFF ("ftyp") major brands
const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
]);
const HEIF_BRANDS = new Set(['mif1', 'msf1', 'heif']);
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'dash',
]);

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const ascii = (buf: Buffer, start: number, end: number): string =>
  buf.toString('latin1', start, end);

/**
 * The real type of an uploaded file, from its first bytes; null when it is not one of
 * the supported image or video formats. The client's file name and Content-Type are
 * never trusted for this.
 */
export function sniffMediaType(buf: Buffer): SniffedType | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return JPEG;
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return PNG;
  }
  if (
    buf.length >= 12 &&
    ascii(buf, 0, 4) === 'RIFF' &&
    ascii(buf, 8, 12) === 'WEBP'
  ) {
    return WEBP;
  }
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12);
    if (HEIC_BRANDS.has(brand)) return HEIC;
    if (HEIF_BRANDS.has(brand)) return HEIF;
    if (brand === 'qt  ') return MOV;
    if (MP4_BRANDS.has(brand)) return MP4;
  }
  return null;
}
