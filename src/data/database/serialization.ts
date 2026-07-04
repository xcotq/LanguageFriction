export function dateToText(value: Date): string {
  return value.toISOString();
}

export function optionalDateToText(value?: Date): string | null {
  return value ? dateToText(value) : null;
}

export function textToDate(value: string): Date {
  return new Date(value);
}

export function optionalTextToDate(value?: string | null): Date | undefined {
  return value ? textToDate(value) : undefined;
}

export function jsonToText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function optionalJsonToText(value?: unknown): string | null {
  return value === undefined ? null : jsonToText(value);
}

export function textToJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function optionalTextToJson<T>(
  value: string | null | undefined
): T | undefined {
  return value == null ? undefined : textToJson<T>(value);
}

export function textToJsonWithFallback<T>(
  value: string | null | undefined,
  fallback: T
): T {
  return value == null ? fallback : textToJson<T>(value);
}
