/** Instagram usernames: 1–30 letters, digits, dots and underscores (same rule as the API). */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * What the user typed → the plain username, or null to remove it, or undefined when it cannot
 * be an Instagram username. Accepts "name", "@name" and pasted instagram.com links.
 */
export function parseInstagramHandle(input: string): string | null | undefined {
  let text = input.trim();
  if (text === '') return null;
  const link = text.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i);
  if (link) text = link[1];
  text = text.replace(/^@+/, '');
  return HANDLE.test(text) ? text : undefined;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}
