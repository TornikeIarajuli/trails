// Wikimedia Commons: geotagged file search and file metadata (licence, author, size).
// Serial requests, <= 5/s, maxlag=5, every response cached on disk.
import { request } from './http.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';

async function api(params, { refresh = false } = {}) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  const url = `${API}?${qs}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await request(url, {
      bucket: 'commons',
      throttleKey: 'commons',
      minIntervalMs: 1000,
      timeoutMs: 60_000,
      retries: 4,
      refresh: refresh || attempt > 0,
      validate: (v) => {
        if (v.error) throw Object.assign(new Error(`Commons API error ${v.error.code}: ${v.error.info}`), { lag: v.error.code === 'maxlag' });
      },
    }).catch((err) => {
      if (err.lag) return null;
      throw err;
    });
    if (res) return res;
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error('Commons API kept reporting maxlag');
}

/** Geotagged files inside a bounding box [minLng, minLat, maxLng, maxLat] (at most ~20 x 20 km). */
export async function geosearchBox(box, limit = 500) {
  const res = await api({
    action: 'query',
    list: 'geosearch',
    gsbbox: [box[3], box[0], box[1], box[2]].map((v) => v.toFixed(4)).join('|'),
    gsnamespace: '6',
    gslimit: String(limit),
  });
  return (res.query?.geosearch ?? []).map((g) => ({ title: g.title, coord: [g.lon, g.lat], pageid: g.pageid }));
}

/** Geotagged files within radiusM (<= 10000) of a [lng, lat] point. */
export async function geosearch(p, radiusM, limit = 100) {
  const res = await api({
    action: 'query',
    list: 'geosearch',
    gscoord: `${p[1].toFixed(5)}|${p[0].toFixed(5)}`,
    gsradius: String(Math.min(10000, Math.round(radiusM))),
    gsnamespace: '6',
    gslimit: String(limit),
  });
  return (res.query?.geosearch ?? []).map((g) => ({ title: g.title, coord: [g.lon, g.lat], pageid: g.pageid }));
}

/** imageinfo + extmetadata for up to 50 titles per request; returns Map(title → info). */
export async function fileInfo(titles) {
  const out = new Map();
  // at most 50 titles and ~5000 URL characters per request (long titles otherwise hit HTTP 414)
  const batches = [];
  let cur = [];
  let len = 0;
  for (const t of titles) {
    const l = encodeURIComponent(t).length + 3;
    if (cur.length && (cur.length >= 50 || len + l > 5000)) {
      batches.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += l;
  }
  if (cur.length) batches.push(cur);
  for (const batch of batches) {
    const res = await api({
      action: 'query',
      prop: 'imageinfo|coordinates',
      iiprop: 'url|size|mime|extmetadata|timestamp',
      iiurlwidth: '1280',
      iiextmetadatafilter: 'LicenseShortName|License|LicenseUrl|Artist|Credit|ImageDescription|ObjectName|Categories|DateTimeOriginal|Copyrighted|AttributionRequired|Restrictions|UsageTerms',
      titles: batch.join('|'),
    });
    for (const page of res.query?.pages ?? []) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      const meta = {};
      for (const [k, v] of Object.entries(ii.extmetadata ?? {})) meta[k] = v?.value ?? null;
      out.set(page.title, {
        title: page.title,
        pageid: page.pageid,
        width: ii.width,
        height: ii.height,
        size: ii.size,
        mime: ii.mime,
        url: ii.url,
        thumburl: ii.thumburl,
        thumbwidth: ii.thumbwidth,
        descriptionurl: ii.descriptionurl,
        coord: page.coordinates?.[0] ? [page.coordinates[0].lon, page.coordinates[0].lat] : null,
        meta,
      });
    }
  }
  return out;
}

export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Licence accepted by the brief: Public Domain, CC0, CC BY (any version), CC BY-SA (any version). */
export function acceptedLicence(meta) {
  const code = String(meta.License ?? '').toLowerCase().trim();
  const short = stripHtml(meta.LicenseShortName ?? '');
  const url = String(meta.LicenseUrl ?? '');
  if (/\b(nc|nd)\b|non-?commercial|no ?deriv/i.test(`${code} ${short} ${url}`)) return null;
  if (/^cc0/.test(code) || /^cc0/i.test(short)) return { short: 'CC0 1.0', url: url || 'https://creativecommons.org/publicdomain/zero/1.0/' };
  if (/^pd\b|^pd-|^public domain/.test(code) || /^public domain$/i.test(short)) return { short: 'Public domain', url: url || null };
  let m = code.match(/^cc-by-sa-(\d(?:\.\d)?)/) || short.match(/^CC BY-SA (\d(?:\.\d)?)/i);
  if (m) return { short: `CC BY-SA ${m[1]}`, url: url || `https://creativecommons.org/licenses/by-sa/${m[1]}/` };
  m = code.match(/^cc-by-(\d(?:\.\d)?)/) || short.match(/^CC BY (\d(?:\.\d)?)/i);
  if (m) return { short: `CC BY ${m[1]}`, url: url || `https://creativecommons.org/licenses/by/${m[1]}/` };
  return null;
}

/** Plain-text author, or null when there is none worth crediting. */
export function authorOf(meta) {
  let a = stripHtml(meta.Artist ?? '');
  a = a.replace(/^(author|photo|photographer|by)\s*[:\-]\s*/i, '').replace(/\s*\((talk|contribs?)\)\s*/gi, ' ').trim();
  if (!a || /^(unknown|anonymous|not provided|see (below|description)|own work)$/i.test(a)) return null;
  if (a.length > 120) a = `${a.slice(0, 117)}...`;
  return a;
}

/** File titles directly in a Commons category (no subcategories). */
export async function categoryFiles(category, limit = 200) {
  const res = await api({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category.replace(/^Category:/, '')}`,
    cmtype: 'file',
    cmnamespace: '6',
    cmlimit: String(Math.min(500, limit)),
  });
  return (res.query?.categorymembers ?? []).map((m) => m.title);
}
