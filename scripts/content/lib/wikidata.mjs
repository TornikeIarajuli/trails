// Wikidata: image (P18), Commons category (P373) and coordinates (P625) of named places.
// Serial requests, maxlag=5, cached on disk like every other service.
import { request } from './http.mjs';

const API = 'https://www.wikidata.org/w/api.php';

async function api(params) {
  const qs = new URLSearchParams({ format: 'json', maxlag: '5', ...params });
  return request(`${API}?${qs}`, {
    bucket: 'wikidata',
    throttleKey: 'wikidata',
    minIntervalMs: 1000,
    timeoutMs: 60_000,
    retries: 4,
    validate: (v) => {
      if (v.error) throw new Error(`Wikidata API error ${v.error.code}: ${v.error.info}`);
    },
  });
}

const claimValues = (entity, prop) => (entity.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => v != null);

/** { qid: { label, label_ka, images: [file names], category, coord: [lng, lat] | null } } */
export async function entities(qids) {
  const out = {};
  const ids = [...new Set(qids)].filter((q) => /^Q\d+$/.test(q));
  for (let i = 0; i < ids.length; i += 40) {
    const res = await api({ action: 'wbgetentities', ids: ids.slice(i, i + 40).join('|'), props: 'claims|labels', languages: 'en|ka' });
    for (const [qid, e] of Object.entries(res.entities ?? {})) {
      if (e.missing !== undefined) continue;
      const c = claimValues(e, 'P625')[0];
      out[qid] = {
        qid,
        label: e.labels?.en?.value ?? null,
        label_ka: e.labels?.ka?.value ?? null,
        images: claimValues(e, 'P18'),
        category: claimValues(e, 'P373')[0] ?? null,
        coord: c && typeof c.longitude === 'number' ? [c.longitude, c.latitude] : null,
      };
    }
  }
  return out;
}

/** Items whose label or alias matches the text (English search). */
export async function search(text, limit = 10) {
  const res = await api({ action: 'wbsearchentities', search: text, language: 'en', uselang: 'en', type: 'item', limit: String(limit) });
  return (res.search ?? []).map((s) => s.id);
}
