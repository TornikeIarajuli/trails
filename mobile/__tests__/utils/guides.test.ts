import { bookingDates, bookingStatusLabel, guideFormErrors, localIsoDate, priceLabel } from '../../utils/guides';

describe('guides', () => {
  it('writes the price with its note', () => {
    expect(priceLabel({ price_gel: 250, price_note: 'up to 6 people' })).toBe('250 GEL a day · up to 6 people');
    expect(priceLabel({ price_gel: 1200, price_note: null })).toBe('1,200 GEL a day');
    expect(priceLabel({ price_gel: null, price_note: 'Ask me' })).toBe('Ask me');
    expect(priceLabel({ price_gel: null, price_note: null })).toBeNull();
  });

  it('writes the dates of a booking, across months too', () => {
    expect(bookingDates('2026-12-12', 1)).toBe('Sat 12 Dec');
    expect(bookingDates('2026-12-12', 3)).toBe('12–14 Dec');
    expect(bookingDates('2026-12-30', 3)).toBe('30 Dec – 1 Jan');
  });

  it('says what a booking state means to the hiker and to the guide', () => {
    expect(bookingStatusLabel('requested', 'hiker')).toBe('Waiting for the guide');
    expect(bookingStatusLabel('requested', 'guide')).toBe('New request');
    expect(bookingStatusLabel('accepted', 'hiker')).toBe('Accepted');
  });

  it('writes dates as the phone sees them', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('checks the guide form before sending', () => {
    const input = {
      headline: 'Guide',
      bio: 'Short',
      regions: [],
      languages: [],
      certifications: null,
      price_gel: null,
      price_note: null,
      contact_phone: null,
      contact_whatsapp: false,
      contact_telegram: null,
      trail_ids: [],
    };
    expect(Object.keys(guideFormErrors(input)).sort()).toEqual(['bio', 'contact', 'languages', 'regions']);
    expect(
      guideFormErrors({
        ...input,
        bio: 'Ten years of guiding in Svaneti.',
        regions: ['Svaneti'],
        languages: ['English'],
        contact_telegram: 'nino_guide',
      }),
    ).toEqual({});
  });
});
