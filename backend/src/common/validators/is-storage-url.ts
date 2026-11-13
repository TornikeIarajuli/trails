import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

const MAX_URL_LENGTH = 2048;

/** `<SUPABASE_URL>/storage/v1/object/public/`, built the same way supabase-js builds it. */
function publicStoragePrefix(supabaseUrl: string): string | null {
  try {
    const base = supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`;
    return new URL('storage/v1/object/public/', base).href;
  } catch {
    return null;
  }
}

/**
 * True when `value` points at an object in this project's public Supabase storage, i.e. a
 * URL the API itself handed out after an upload. Anything else (another host, a data: or
 * javascript: URL, a path that climbs out of the public storage root) is rejected, because
 * these values are stored and later loaded by other users' devices.
 */
export function isPublicStorageUrl(
  value: unknown,
  supabaseUrl: string | undefined = process.env.SUPABASE_URL,
): value is string {
  if (typeof value !== 'string' || !supabaseUrl) return false;
  if (value.length > MAX_URL_LENGTH || /\s/.test(value)) return false;

  const prefix = publicStoragePrefix(supabaseUrl);
  if (!prefix || !value.startsWith(prefix)) return false;

  try {
    // The URL parser resolves "../" (also when percent-encoded), so the normalised form
    // must still be inside the public storage root.
    const normalised = new URL(value).href;
    return normalised.startsWith(prefix) && normalised.length > prefix.length;
  } catch {
    return false;
  }
}

export function IsStorageUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isStorageUrl',
      validator: {
        validate: (value): boolean => isPublicStorageUrl(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + '$property must be a file uploaded through this API',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
