// HTTP Basic credential check shared by src/proxy.ts and requireAdmin().
// Web Crypto only (no Node APIs), so it works in whichever runtime the proxy is deployed to.

export type BasicAuthResult = "ok" | "unauthorized" | "not_configured";

const encoder = new TextEncoder();

function toBytes(binary: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeCredentials(
  header: string | null | undefined,
): { user: Uint8Array<ArrayBuffer>; pass: Uint8Array<ArrayBuffer> } | null {
  const match = /^\s*basic\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return null;

  let decoded: string;
  try {
    decoded = atob(match[1]);
  } catch {
    return null;
  }

  // Only the first colon separates the two: the password itself may contain ":" (RFC 7617).
  const colon = decoded.indexOf(":");
  if (colon === -1) return null;
  return { user: toBytes(decoded.slice(0, colon)), pass: toBytes(decoded.slice(colon + 1)) };
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function sameDigest(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Browsers send credentials as UTF-8; some older clients send ISO-8859-1, which is what the
// previous check compared against, so a non-ASCII secret is accepted in either encoding.
function latin1Variant(value: string): Uint8Array<ArrayBuffer> | null {
  let ascii = true;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) return null;
    if (code > 0x7f) ascii = false;
  }
  return ascii ? null : toBytes(value);
}

// Digests are compared in full, so timing does not reveal how much of a guess was right.
async function matches(provided: Uint8Array<ArrayBuffer>, expected: string): Promise<boolean> {
  const actual = await sha256(provided);
  const utf8 = sameDigest(actual, await sha256(encoder.encode(expected)));
  const alternative = latin1Variant(expected);
  const latin1 = alternative ? sameDigest(actual, await sha256(alternative)) : false;
  return utf8 || latin1;
}

export async function checkBasicAuth(
  header: string | null | undefined,
  expectedUser: string | undefined = process.env.ADMIN_USERNAME,
  expectedPass: string | undefined = process.env.ADMIN_PASSWORD,
): Promise<BasicAuthResult> {
  // Fail closed: an unset variable must never compare equal to a missing credential.
  if (!expectedUser || !expectedPass) return "not_configured";

  const credentials = decodeCredentials(header);
  if (!credentials) return "unauthorized";

  const userOk = await matches(credentials.user, expectedUser);
  const passOk = await matches(credentials.pass, expectedPass);
  return userOk && passOk ? "ok" : "unauthorized";
}
