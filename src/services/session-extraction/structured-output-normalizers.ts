export function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function compactRecord(value: unknown): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(asRecord(value)).filter(([, item]) => {
            if (item == null || item === "") {
                return false;
            }

            return !Array.isArray(item) || item.length > 0;
        })
    );
}

export function isNonNullable<T>(value: T | null | undefined): value is T {
    return value != null;
}

export function asString(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

export function clampConfidence(value: unknown, fallback = 0.7) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : fallback;
}
