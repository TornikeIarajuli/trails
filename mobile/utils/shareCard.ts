/** Layout helpers for the "share your hike" picture (an Instagram story, 1080 × 1920). */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteDrawing {
  /** SVG path data in card pixels. */
  d: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/** Keeps every n-th point so the path stays light, always keeping the first and the last. */
function thin(points: LatLng[], max: number): LatLng[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/**
 * The route drawn into a box (x, y, size × size), north up, keeping its shape (metres east and
 * north, not degrees), centred. Null when there is nothing to draw.
 */
export function routeDrawing(
  points: LatLng[],
  box: { x: number; y: number; size: number },
  maxPoints = 400,
): RouteDrawing | null {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length < 2) return null;
  const pts = thin(valid, maxPoints);

  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p.lng * kx);
  const ys = pts.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  if (span === 0) return null;

  const scale = box.size / span;
  const offsetX = box.x + (box.size - (maxX - minX) * scale) / 2;
  const offsetY = box.y + (box.size - (maxY - minY) * scale) / 2;
  const at = (i: number) => ({
    x: Math.round((offsetX + (xs[i] - minX) * scale) * 10) / 10,
    // North up: larger latitude, smaller y
    y: Math.round((offsetY + (maxY - ys[i]) * scale) * 10) / 10,
  });

  const coords = pts.map((_, i) => at(i));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ');
  return { d, start: coords[0], end: coords[coords.length - 1] };
}

/**
 * Splits a title into at most `maxLines` lines of about `maxChars`: on two lines the most even
 * split ("Juta to Roshka" / "via Chaukhi Pass"), ending with "…" when it does not fit.
 */
export function wrapTitle(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const whole = words.join(' ');
  if (whole.length <= maxChars || maxLines <= 1) return [whole];

  if (maxLines === 2) {
    let best: [string, string] | null = null;
    for (let i = 1; i < words.length; i++) {
      const first = words.slice(0, i).join(' ');
      const second = words.slice(i).join(' ');
      if (first.length > maxChars || second.length > maxChars) continue;
      if (!best || Math.max(first.length, second.length) < Math.max(best[0].length, best[1].length)) {
        best = [first, second];
      }
    }
    if (best) return best;
  }

  // Too long for that: fill the lines in order and cut the rest
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,.;:-]+$/, '')}…`;
  return kept;
}

/** The title size that fits: long trail names get a smaller font. */
export function titleFontSize(title: string): number {
  if (title.length <= 18) return 92;
  if (title.length <= 30) return 80;
  return 68;
}

export interface CardStat {
  value: string;
  label: string;
}

/** "4h 20m" for the card. */
function formatCardTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Distance, ascent and (when it is a real one) time, in the order the card shows them. */
export function cardStats(input: {
  distanceKm: number | null | undefined;
  ascentM: number | null | undefined;
  elapsedSeconds: number | null | undefined;
  timeIsReal: boolean;
}): CardStat[] {
  const stats: CardStat[] = [];
  if (input.distanceKm != null && input.distanceKm > 0) {
    const km = input.distanceKm;
    stats.push({ value: `${km >= 10 ? Math.round(km) : km.toFixed(1)} km`, label: 'Distance' });
  }
  if (input.ascentM != null && input.ascentM > 0) {
    stats.push({ value: `${Math.round(input.ascentM).toLocaleString('en-US')} m`, label: 'Ascent' });
  }
  if (input.timeIsReal && input.elapsedSeconds != null && input.elapsedSeconds > 0) {
    stats.push({ value: formatCardTime(input.elapsedSeconds), label: 'Time' });
  }
  return stats;
}

/** "14 November 2026" (or the year alone for a hike marked as done before the app). */
export function cardDate(iso: string | null | undefined, yearOnly = false): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (yearOnly) return String(date.getFullYear());
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
