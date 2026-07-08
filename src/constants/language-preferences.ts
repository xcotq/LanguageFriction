export const SUPPORTED_LANGUAGE_OPTIONS = [
    { code: "en", label: "English" },
    { code: "zh", label: "Chinese" },
    { code: "de", label: "German" },
    { code: "ja", label: "Japanese" },
    { code: "fr", label: "French" },
] as const;

export type SupportedLanguageCode =
    (typeof SUPPORTED_LANGUAGE_OPTIONS)[number]["code"];

export type LanguagePreferenceSettings = {
    primaryLanguage: SupportedLanguageCode;
    learningLanguage: SupportedLanguageCode;
};

export const DEFAULT_LANGUAGE_PREFERENCE_SETTINGS: LanguagePreferenceSettings =
    {
        primaryLanguage: "zh",
        learningLanguage: "en",
    };

const supportedLanguageCodes = new Set<string>(
    SUPPORTED_LANGUAGE_OPTIONS.map((option) => option.code)
);

export function isSupportedLanguageCode(
    value: unknown
): value is SupportedLanguageCode {
    return typeof value === "string" && supportedLanguageCodes.has(value);
}

export function getSupportedLanguageLabel(code: SupportedLanguageCode) {
    return (
        SUPPORTED_LANGUAGE_OPTIONS.find((option) => option.code === code)
            ?.label ?? code
    );
}
