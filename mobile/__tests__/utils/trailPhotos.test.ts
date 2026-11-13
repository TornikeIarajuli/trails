import { buildPhotoSlides, coverCreditFromList, photoCredit } from '../../utils/trailPhotos';
import type { TrailMedia } from '../../types/trail';

describe('coverCreditFromList', () => {
  const credits = [
    { trail_id: 't1', file: 'Gergeti Trinity Church.jpg', author: 'Jane Doe', license: 'CC BY-SA 4.0' },
    { trail_id: 't1', file: 'Mount Kazbek view.jpg', author: 'John Roe', license: 'CC BY 2.0' },
    { trail_id: 't2', file: 'Ushguli.jpg', author: 'Ana', license: 'CC0' },
  ];

  it('matches the credit whose file name appears in the cover URL', () => {
    expect(coverCreditFromList('https://cdn/x/mount-kazbek-view-960.webp', 't1', credits)).toBe(
      'Photo: John Roe · CC BY 2.0 · Wikimedia Commons',
    );
  });

  it('uses the only credit of a trail when no file name matches', () => {
    expect(coverCreditFromList('https://cdn/t2/cover.webp', 't2', credits)).toBe('Photo: Ana · CC0 · Wikimedia Commons');
  });

  it('does not guess between several credits', () => {
    expect(coverCreditFromList('https://cdn/t1/cover.webp', 't1', credits)).toBeNull();
  });

  it('returns null without a cover, a trail or credits', () => {
    expect(coverCreditFromList(null, 't1', credits)).toBeNull();
    expect(coverCreditFromList('https://cdn/x.webp', undefined, credits)).toBeNull();
    expect(coverCreditFromList('https://cdn/x.webp', 't3', [])).toBeNull();
  });
});

const media = (id: string, url: string, caption: string | null = null, type: 'photo' | 'video' = 'photo'): TrailMedia => ({
  id,
  trail_id: 't1',
  type,
  url,
  caption,
  sort_order: 0,
});

describe('photoCredit', () => {
  it('returns Wikimedia-style credits', () => {
    expect(photoCredit('Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons')).toBe(
      'Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons',
    );
  });

  it('ignores other captions and empty values', () => {
    expect(photoCredit('Mestia to Ushguli Trek - Photo 1')).toBeNull();
    expect(photoCredit('')).toBeNull();
    expect(photoCredit(null)).toBeNull();
    expect(photoCredit(undefined)).toBeNull();
  });
});

describe('buildPhotoSlides', () => {
  it('returns no slides without a cover or photos', () => {
    expect(buildPhotoSlides(null, [])).toEqual([]);
    expect(buildPhotoSlides(undefined, undefined)).toEqual([]);
  });

  it('puts the cover first and keeps gallery order', () => {
    const slides = buildPhotoSlides('https://x/cover.webp', [media('a', 'https://x/a.webp'), media('b', 'https://x/b.webp')]);
    expect(slides.map((s) => s.url)).toEqual(['https://x/cover.webp', 'https://x/a.webp', 'https://x/b.webp']);
  });

  it('shows a photo used as cover only once, with its credit', () => {
    const credit = 'Photo: A · CC BY 4.0 · Wikimedia Commons';
    const slides = buildPhotoSlides('https://x/a.webp', [media('a', 'https://x/a.webp', credit), media('b', 'https://x/b.webp')]);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toEqual({ id: 'cover', url: 'https://x/a.webp', credit });
  });

  it('uses the fallback credit only for a cover that is not in the gallery', () => {
    expect(buildPhotoSlides('https://x/cover.webp', [], 'Photo: A · CC0 · Wikimedia Commons')[0].credit).toBe(
      'Photo: A · CC0 · Wikimedia Commons',
    );
    expect(buildPhotoSlides('https://x/a.webp', [media('a', 'https://x/a.webp', 'plain caption')], 'Photo: B')[0].credit).toBeNull();
  });

  it('skips videos and duplicate gallery entries', () => {
    const slides = buildPhotoSlides(null, [
      media('a', 'https://x/a.webp'),
      media('v', 'https://x/v.mp4', null, 'video'),
      media('a2', 'https://x/a.webp'),
    ]);
    expect(slides.map((s) => s.id)).toEqual(['a']);
  });
});
