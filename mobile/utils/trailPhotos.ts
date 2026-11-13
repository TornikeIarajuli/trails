import type { TrailMedia } from '../types/trail';

export interface PhotoSlide {
  id: string;
  url: string;
  credit: string | null;
}

/**
 * Photos taken from Wikimedia Commons carry their attribution in the caption as
 * "Photo: <author> · <licence> · Wikimedia Commons". The licences require it to be
 * shown with the photo, so only captions of that form are treated as credits.
 */
export function photoCredit(caption: string | null | undefined): string | null {
  const text = caption?.trim();
  return text && /^photo:/i.test(text) ? text : null;
}

/** An entry of the bundled photo credit list (assets/data/photo-credits.json). */
export interface PhotoCreditEntry {
  trail_id: string;
  trail_name?: string;
  file?: string;
  author?: string;
  license?: string;
  license_url?: string;
  source_url?: string;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Credit for a cover photo that is not also in the trail's gallery (so it has no
 * caption): the bundled credit whose file name appears in the cover URL, or the
 * trail's only credit when there is exactly one.
 */
export function coverCreditFromList(
  coverUrl: string | null | undefined,
  trailId: string | null | undefined,
  credits: PhotoCreditEntry[],
): string | null {
  if (!coverUrl || !trailId) return null;
  const forTrail = credits.filter((c) => c && c.trail_id === trailId && c.author);
  const url = normalise(safeDecode(coverUrl));
  const byFile = forTrail.find((c) => {
    const base = normalise((c.file ?? '').replace(/^file:/i, '').replace(/\.[a-z0-9]+$/i, ''));
    return base.length >= 4 && url.includes(base);
  });
  const entry = byFile ?? (forTrail.length === 1 ? forTrail[0] : undefined);
  if (!entry) return null;
  return [`Photo: ${entry.author}`, entry.license, 'Wikimedia Commons'].filter(Boolean).join(' · ');
}

/** Cover first, then the gallery; a photo that is both cover and gallery item appears once. */
export function buildPhotoSlides(
  coverUrl: string | null | undefined,
  media: TrailMedia[] | null | undefined,
  fallbackCoverCredit: string | null = null,
): PhotoSlide[] {
  const photos = (media ?? []).filter((m) => m.type === 'photo' && !!m.url);
  const slides: PhotoSlide[] = [];
  const seen = new Set<string>();

  if (coverUrl) {
    const sameAsCover = photos.find((m) => m.url === coverUrl);
    const credit = sameAsCover ? photoCredit(sameAsCover.caption) : fallbackCoverCredit;
    slides.push({ id: 'cover', url: coverUrl, credit });
    seen.add(coverUrl);
  }
  for (const photo of photos) {
    if (seen.has(photo.url)) continue;
    seen.add(photo.url);
    slides.push({ id: photo.id, url: photo.url, credit: photoCredit(photo.caption) });
  }
  return slides;
}
