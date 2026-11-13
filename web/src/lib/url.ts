// Returns the value only if it is an http(s) URL. User-supplied values (photo links,
// reported content) must pass through this before being used as a link target.
export function httpUrl(value: string | null | undefined): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}
