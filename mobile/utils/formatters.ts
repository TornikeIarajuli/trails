export function formatDistance(km: number | null): string {
  if (km === null) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

export function formatElevation(meters: number | null): string {
  if (meters === null) return '--';
  return `${meters}m`;
}

export function formatDuration(hours: number | null): string {
  if (hours === null) return '--';
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
