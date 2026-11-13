/** URL builders for handing a position or a message to another app. Pure, so they can be unit-tested. */

function coordinate(value: number): string {
  return value.toFixed(6);
}

/** A link that shows the position to whoever receives it, on any device. */
export function buildMapsShareLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${coordinate(lat)},${coordinate(lng)}`;
}

/** Opens the SMS composer with the text filled in; the user picks the recipient. */
export function buildSmsUrl(body: string, platform: string): string {
  // iOS and Android disagree on the separator before `body`
  const separator = platform === 'ios' ? '&' : '?';
  return `sms:${separator}body=${encodeURIComponent(body)}`;
}

export function buildSosSmsBody(position: { lat: number; lng: number } | null): string {
  return position
    ? `I need help. My location: ${buildMapsShareLink(position.lat, position.lng)}`
    : 'I need help. I could not get my GPS position.';
}
