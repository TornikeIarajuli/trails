import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

/** A [lng, lat] pair of finite, in-range numbers (safe to write into EWKT). */
export function isLngLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(value[0] as number) <= 180 &&
    Math.abs(value[1] as number) <= 90
  );
}

export function IsLngLat(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isLngLat',
      validator: {
        validate: (value): boolean => isLngLat(value),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be [lng, lat]',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/** A list of 2 to `maxPoints` [lng, lat] pairs. */
export function IsLngLatList(
  maxPoints: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isLngLatList',
      validator: {
        validate: (value): boolean =>
          Array.isArray(value) &&
          value.length >= 2 &&
          value.length <= maxPoints &&
          value.every(isLngLat),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + `$property must be 2 to ${maxPoints} [lng, lat] pairs`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
