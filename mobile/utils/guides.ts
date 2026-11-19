/** Local guides and their bookings: labels and checks, pure so they can be tested. */
import type { BookingStatus, Guide, GuideProfileInput } from '../services/guides';

/** The regions trails are listed under, as the server checks them. */
export const GUIDE_REGIONS = [
  'Adjara',
  'Borjomi-Kharagauli',
  'Imereti',
  'Kakheti',
  'Kazbegi',
  'Khevsureti',
  'Kvemo Kartli',
  'Mtskheta-Mtianeti',
  'Racha',
  'Samegrelo',
  'Samtskhe-Javakheti',
  'Shida Kartli',
  'Svaneti',
  'Tbilisi',
  'Tusheti',
];

/** Languages offered as chips in the guide form. */
export const GUIDE_LANGUAGES = [
  'Georgian',
  'English',
  'Russian',
  'German',
  'French',
  'Hebrew',
  'Polish',
  'Ukrainian',
  'Spanish',
  'Italian',
  'Turkish',
  'Chinese',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "250 GEL a day · up to 6 people"; null without a price. */
export function priceLabel(guide: Pick<Guide, 'price_gel' | 'price_note'>): string | null {
  if (guide.price_gel == null) return guide.price_note || null;
  return [`${guide.price_gel.toLocaleString('en-US')} GEL a day`, guide.price_note].filter(Boolean).join(' · ');
}

/** "Sat 12 Dec", or "12–14 Dec" / "30 Dec – 1 Jan" for several days. YYYY-MM-DD in, no time zone. */
export function bookingDates(startDate: string, days: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  if (days <= 1) return `${WEEKDAYS[start.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
  const end = new Date(start.getTime() + (days - 1) * 86_400_000);
  const sameMonth = end.getUTCMonth() === start.getUTCMonth();
  return sameMonth
    ? `${d}–${end.getUTCDate()} ${MONTHS[m - 1]}`
    : `${d} ${MONTHS[m - 1]} – ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]}`;
}

/** What a booking's state means to the one looking at it. */
export function bookingStatusLabel(status: BookingStatus, role: 'hiker' | 'guide'): string {
  switch (status) {
    case 'requested':
      return role === 'guide' ? 'New request' : 'Waiting for the guide';
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return 'Declined';
    case 'cancelled':
      return 'Cancelled';
  }
}

/** A date as YYYY-MM-DD in the phone's own calendar (for the booking's first day). */
export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type GuideFormErrors = Partial<Record<'headline' | 'bio' | 'regions' | 'languages' | 'contact', string>>;

/** What stops the guide form from being sent, field by field (empty when it can go). */
export function guideFormErrors(input: GuideProfileInput): GuideFormErrors {
  const errors: GuideFormErrors = {};
  if (input.headline.trim().length < 3) errors.headline = 'Say in a few words who you are as a guide.';
  if (input.bio.trim().length < 20) errors.bio = 'Tell hikers a little more: at least 20 characters.';
  if (input.regions.length === 0) errors.regions = 'Pick at least one region.';
  if (input.languages.length === 0) errors.languages = 'Pick at least one language.';
  if (!input.contact_phone?.trim() && !input.contact_telegram?.trim()) {
    errors.contact = 'Add a phone number or a Telegram name, to share with hikers you accept.';
  }
  return errors;
}
