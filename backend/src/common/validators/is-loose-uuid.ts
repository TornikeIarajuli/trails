import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

// Seeded rows use ids such as a0000000-0000-0000-0000-000000000001. They are valid for
// Postgres' uuid type but are not RFC 4122 variants, so @IsUUID() rejects them.
const LOOSE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLooseUuid(value: unknown): value is string {
  return typeof value === 'string' && LOOSE_UUID.test(value);
}

export function IsLooseUuid(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isLooseUuid',
      validator: {
        validate: (value): boolean => isLooseUuid(value),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be a UUID',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
