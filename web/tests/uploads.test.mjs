import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPLOAD_BYTES,
  parseGpxTrack,
  sniffImage,
  storageObjectPath,
  subsample,
  uploadSizeError,
} from "../src/lib/uploads.ts";

const gpx = (points) => `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${points}</trkseg></trk></gpx>`;

test("uploadSizeError allows up to 4 MB and explains anything else", () => {
  assert.equal(uploadSizeError(1), null);
  assert.equal(uploadSizeError(MAX_UPLOAD_BYTES), null);
  assert.match(uploadSizeError(MAX_UPLOAD_BYTES + 1), /too large.*4 MB/);
  assert.match(uploadSizeError(0), /empty/);
});

test("sniffImage recognises JPEG, PNG and WebP by their leading bytes", () => {
  assert.deepEqual(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), { ext: "jpg", contentType: "image/jpeg" });
  assert.deepEqual(
    sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    { ext: "png", contentType: "image/png" },
  );
  assert.deepEqual(
    sniffImage(new TextEncoder().encode("RIFF\u0001\u0002\u0003\u0004WEBPVP8 ")),
    { ext: "webp", contentType: "image/webp" },
  );
});

test("sniffImage rejects everything else, whatever it is called", () => {
  const text = (s) => new TextEncoder().encode(s);
  assert.equal(sniffImage(text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null);
  assert.equal(sniffImage(text("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffImage(text("GIF89a")), null);
  assert.equal(sniffImage(text("RIFF\u0001\u0002\u0003\u0004WAVEfmt ")), null);
  assert.equal(sniffImage(Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])), null); // HEIC
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8])), null);
  assert.equal(sniffImage(new Uint8Array(0)), null);
});

test("parseGpxTrack reads points in either attribute order and quote style", () => {
  const result = parseGpxTrack(
    gpx(`<trkpt lat="42.6655" lon="44.6146"><ele>1800</ele></trkpt>
         <trkpt lon='44.6147' lat='42.6656'/>
         <trkpt
            lat = "4.26657e1"
            lon = "-0.5" />`),
  );
  assert.deepEqual(result, { ok: true, coords: [[44.6146, 42.6655], [44.6147, 42.6656], [-0.5, 42.6657]] });
});

test("parseGpxTrack rejects out-of-range and malformed coordinates", () => {
  for (const point of [
    `<trkpt lat="90.5" lon="44"/>`,
    `<trkpt lat="42" lon="181"/>`,
    `<trkpt lat="-91" lon="44"/>`,
    `<trkpt lat="abc" lon="44"/>`,
    `<trkpt lat="" lon="44"/>`,
    `<trkpt lon="44"/>`,
    `<trkpt lat="42" lon='44"/>`,
  ]) {
    const result = parseGpxTrack(gpx(`<trkpt lat="42" lon="44"/>${point}<trkpt lat="42.1" lon="44.1"/>`));
    assert.equal(result.ok, false, point);
    assert.match(result.error, /Track point 2 /, point);
  }
});

test("parseGpxTrack rejects files that are not GPX tracks", () => {
  assert.equal(parseGpxTrack("just some text").ok, false);
  assert.equal(parseGpxTrack(`<kml><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></kml>`).ok, false);
  assert.equal(parseGpxTrack(gpx(`<trkpt lat="1" lon="1"/>`).replace("<gpx", "\u0000<gpx")).ok, false);
  assert.match(parseGpxTrack(gpx("")).error, /No valid track points/);
  assert.match(parseGpxTrack(gpx(`<trkpt lat="1" lon="1"/>`)).error, /No valid track points/);
  assert.match(parseGpxTrack(gpx(`<wpt lat="1" lon="1"/><wpt lat="2" lon="2"/>`)).error, /No valid track points/);
});

test("subsample keeps the first and last point and respects the limit", () => {
  const points = Array.from({ length: 2001 }, (_, i) => i);
  const sampled = subsample(points, 800);
  assert.ok(sampled.length <= 801);
  assert.equal(sampled[0], 0);
  assert.equal(sampled[sampled.length - 1], 2000);
  assert.equal(subsample(points.slice(0, 800), 800).length, 800);
  assert.deepEqual(subsample([1, 2], 800), [1, 2]);
});

test("storageObjectPath only maps URLs inside this project's bucket", () => {
  const base = "https://abc.supabase.co";
  const url = `${base}/storage/v1/object/public/trail-media/trails/123/photo%20one.jpg`;
  assert.equal(storageObjectPath(url, base, "trail-media"), "trails/123/photo one.jpg");
  assert.equal(storageObjectPath(url, `${base}/`, "trail-media"), "trails/123/photo one.jpg");

  assert.equal(storageObjectPath(url, base, "proof-photos"), null);
  assert.equal(storageObjectPath(url, "https://other.supabase.co", "trail-media"), null);
  assert.equal(storageObjectPath(url, undefined, "trail-media"), null);
  assert.equal(storageObjectPath("https://upload.wikimedia.org/wikipedia/commons/a/a1/Trail.jpg", base, "trail-media"), null);
  assert.equal(storageObjectPath(`${base}/storage/v1/object/public/trail-media/`, base, "trail-media"), null);
  assert.equal(storageObjectPath("not a url", base, "trail-media"), null);

  // Dot segments cannot be used to reach another bucket or to smuggle "../" into the path.
  const prefix = `${base}/storage/v1/object/public/trail-media`;
  assert.equal(storageObjectPath(`${prefix}/../proof-photos/x.jpg`, base, "trail-media"), null);
  assert.equal(storageObjectPath(`${prefix}/%2E%2E/proof-photos/x.jpg`, base, "trail-media"), null);
  assert.equal(storageObjectPath(`${prefix}/a/..%2F..%2Fb.jpg`, base, "trail-media"), null);
});
