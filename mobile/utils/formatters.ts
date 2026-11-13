export function formatDistance(km: number | null | undefined): string {
  if (km == null) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters == null) return '--';
  return `${meters}m`;
}

export function formatDuration(hours: number | null | undefined): string {
  if (hours == null) return '--';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Price in Georgian lari: whole amounts without decimals, otherwise two ("1,250 ₾", "49.90 ₾"). */
export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === '') return '';
  const value = Number(price);
  if (!Number.isFinite(value)) return '';
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${fraction ? `${grouped}.${fraction}` : grouped} ₾`;
}
