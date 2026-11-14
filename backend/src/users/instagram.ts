/** Instagram usernames: 1–30 letters, digits, dots and underscores (same rule as the DB check). */
export const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * The plain username from what a user typed: "@name", "name" or a pasted profile link
 * (instagram.com/name, with or without https, www, a trailing slash or query).
 * Empty input means "remove it" (null). Anything else is returned as typed, for validation
 * to reject.
 */
export function normalizeInstagramHandle(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  let text = value.trim();
  if (text === '') return null;
  const link = text.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i,
  );
  if (link) text = link[1];
  return text.replace(/^@+/, '');
}
