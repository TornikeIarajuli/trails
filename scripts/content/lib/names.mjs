// Name helpers: Georgian national romanisation, loose matching of transliterated toponyms.

const KA_LATIN = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n',
  ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch',
  ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

export const hasGeorgian = (s) => /[ა-ჿ]/.test(s ?? '');
export const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s ?? '');
export const isLatin = (s) => !!s && !hasGeorgian(s) && !hasCyrillic(s) && /[A-Za-z]/.test(s);

/** Georgian script → Latin (national system, apostrophes dropped), each word capitalised. */
export function romanizeKa(s) {
  const latin = [...s].map((ch) => KA_LATIN[ch] ?? ch).join('');
  return latin.replace(/(^|[\s\-–(/])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
}

/** Reduces a Latin toponym to a skeleton that survives the usual transliteration variants. */
export function skeleton(s) {
  let t = (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[’'`ʼ]/g, '').replace(/[^a-z]/g, '');
  t = t
    .replace(/kh/g, 'h')
    .replace(/gh/g, 'g')
    .replace(/tsch|tch/g, 'c')
    .replace(/ts|tz|dz/g, 'c')
    .replace(/zh/g, 'j')
    .replace(/sch|sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/ph/g, 'p')
    .replace(/q/g, 'k')
    .replace(/w/g, 'v')
    .replace(/y/g, 'i')
    .replace(/ou/g, 'u');
  t = t.replace(/(.)\1+/g, '$1');
  return t.replace(/[aeiou]+$/, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/** True when two toponyms are the same name in different spellings. */
export function sameToponym(a, b) {
  const x = skeleton(a);
  const y = skeleton(b);
  if (x.length < 3 || y.length < 3) return false;
  if (x === y) return true;
  const longer = Math.max(x.length, y.length);
  return longer >= 6 && levenshtein(x, y) <= 1;
}

/** All Latin spellings OSM offers for a feature (name:en, int_name, Latin name, romanised Georgian name). */
export function latinNames(f) {
  const out = new Set();
  const add = (v) => v && v.split(/\s*[;/]\s*/).forEach((p) => p.trim() && out.add(p.trim()));
  add(f.name_en);
  add(f.tags?.int_name);
  add(f.tags?.['name:ka-Latn']);
  if (isLatin(f.name)) add(f.name);
  if (isLatin(f.tags?.alt_name)) add(f.tags.alt_name);
  const ka = f.name_ka ?? (hasGeorgian(f.name) ? f.name : null);
  if (ka) add(romanizeKa(ka));
  return [...out];
}

export const georgianName = (f) => f.name_ka ?? (hasGeorgian(f.name) ? f.name : null);

/** Best English display name for an OSM feature (null if only non-Latin names and no Georgian to romanise). */
export function englishName(f) {
  if (f.name_en) return f.name_en;
  if (isLatin(f.name)) return f.name;
  if (f.tags?.int_name && isLatin(f.tags.int_name)) return f.tags.int_name;
  const ka = georgianName(f);
  return ka ? romanizeKa(ka) : null;
}

const GENERIC = new Set(
  `village town city trailhead start end point summit viewpoint view area base approach entrance visitor center centre park
   lake lakes pass glacier waterfall waterfalls fortress castle church monastery tower towers camp campsite bridge valley gorge
   canyon mountain mount mt peak river trail trek hike route the of to and via from at near abandoned big small upper lower
   old new rock rocks spires forest alpine meadow meadows shelter hut ridge hill cross ruins pools pool spring springs
   suspended walkway area road path loop round circular st saint national nature reserve protected areas ski lift station
   place hamlet border junction top cave caves beach resort`.split(/\s+/),
);

/** The proper-noun part of a checkpoint or trail-end label ("Abandoned Village Ketrisi" → ["Ketrisi"]). */
export function properTokens(label) {
  return (label ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^A-Za-z'’ა-ჿ]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w.toLowerCase()) && !/^\d/.test(w));
}

/** Tidies an OSM route name for display; returns { name, unmarked }. */
export function cleanName(raw) {
  let name = (raw ?? '').trim();
  const unmarked = /\(no trail ?mark(er)?s[^)]*\)/i.test(name);
  name = name.replace(/\s*\((no trail ?mark(er)?s[^)]*|planned[^)]*)\)/gi, '');
  name = name.replace(/\s*(=>|->|→)\s*/g, ' - ').replace(/\s*[–—]\s*/g, ' - ').replace(/\s+-\s*|\s*-\s+/g, ' - ');
  name = name.replace(/\s{2,}/g, ' ').replace(/[.\s]+$/, '').trim();
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length > 4 && letters === letters.toUpperCase()) {
    name = name.toLowerCase().replace(/(^|[\s\-(])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
  }
  return { name, unmarked };
}
