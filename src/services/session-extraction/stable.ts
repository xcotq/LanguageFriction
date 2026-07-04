export function normalizeLookupText(text: string) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }

    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

    return `{${entries.join(",")}}`;
}

export function stableHash(value: unknown) {
    const text = typeof value === "string" ? value : stableStringify(value);
    let hash = 0x811c9dc5;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(36);
}

export function createDeterministicId(prefix: string, value: unknown) {
    return `${prefix}:${stableHash(value)}`;
}

export function truncateText(text: string, maxLength: number) {
    const cleanText = text.trim().replace(/\s+/g, " ");

    if (cleanText.length <= maxLength) {
        return cleanText;
    }

    return `${cleanText.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
