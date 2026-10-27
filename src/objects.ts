export function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function plainObjectFrom(value: object): { [key: string]: unknown } {
  const result: { [key: string]: unknown } = {};
  for (const key of Object.keys(value)) {
    result[key] = Reflect.get(value, key);
  }
  return result;
}

export function readObjectField(
  record: { [key: string]: unknown },
  key: string
): { [key: string]: unknown } {
  const value = record[key];
  if (isPlainObject(value)) {
    return value;
  }
  return {};
}
