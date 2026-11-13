import crypto from 'node:crypto';

// RFC 4122 "URL" namespace; every id this pipeline creates is uuidv5(<name>, NAMESPACE_URL).
export const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

export function uuidv5(name, namespace = NAMESPACE_URL) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(ns).update(name, 'utf8').digest();
  const b = hash.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const trailIdForRelation = (relationId) => uuidv5(`osm-relation-${relationId}`);
export const checkpointId = (trailId, key) => uuidv5(`trail-checkpoint/${trailId}/${key}`);
export const mediaId = (trailId, file) => uuidv5(`trail-media/${trailId}/${file}`);

export const isRfc4122 = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export const isUuidLike = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
