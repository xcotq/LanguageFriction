import type { SQLiteDatabase } from "expo-sqlite";

import {
    DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    isSupportedLanguageCode,
    type LanguagePreferenceSettings,
} from "@/constants/language-preferences";
import { dateToText, textToJson } from "@/data/database/serialization";

export type { LanguagePreferenceSettings };

export type PracticeReminderSettings = {
    enabled: boolean;
    pollIntervalMs: number;
};

type AppSettingRow = {
    value_json: string;
};

const PRACTICE_REMINDER_SETTINGS_KEY = "practiceReminder";
const LANGUAGE_PREFERENCES_SETTINGS_KEY = "languagePreferences";
const DEFAULT_PRACTICE_REMINDER_SETTINGS: PracticeReminderSettings = {
    enabled: true,
    pollIntervalMs: 60_000,
};

function normalizePracticeReminderSettings(
    value: Partial<PracticeReminderSettings>
): PracticeReminderSettings {
    return {
        enabled:
            typeof value.enabled === "boolean"
                ? value.enabled
                : DEFAULT_PRACTICE_REMINDER_SETTINGS.enabled,
        pollIntervalMs:
            typeof value.pollIntervalMs === "number" &&
            value.pollIntervalMs >= 10_000
                ? value.pollIntervalMs
                : DEFAULT_PRACTICE_REMINDER_SETTINGS.pollIntervalMs,
    };
}

function normalizeLanguagePreferenceSettings(
    value: Partial<LanguagePreferenceSettings>
): LanguagePreferenceSettings {
    return {
        primaryLanguage: isSupportedLanguageCode(value.primaryLanguage)
            ? value.primaryLanguage
            : DEFAULT_LANGUAGE_PREFERENCE_SETTINGS.primaryLanguage,
        learningLanguage: isSupportedLanguageCode(value.learningLanguage)
            ? value.learningLanguage
            : DEFAULT_LANGUAGE_PREFERENCE_SETTINGS.learningLanguage,
    };
}

export class AppSettingsRepository {
    constructor(private readonly db: SQLiteDatabase) {}

    private async saveJsonSetting(key: string, value: unknown): Promise<void> {
        await this.db.runAsync(
            `
INSERT INTO app_settings (key, value_json, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at
`,
            key,
            JSON.stringify(value),
            dateToText(new Date())
        );
    }

    async getPracticeReminderSettings(): Promise<PracticeReminderSettings> {
        const row = await this.db.getFirstAsync<AppSettingRow>(
            "SELECT value_json FROM app_settings WHERE key = ?",
            PRACTICE_REMINDER_SETTINGS_KEY
        );

        if (!row) {
            return DEFAULT_PRACTICE_REMINDER_SETTINGS;
        }

        try {
            return normalizePracticeReminderSettings(
                textToJson<Partial<PracticeReminderSettings>>(row.value_json)
            );
        } catch {
            return DEFAULT_PRACTICE_REMINDER_SETTINGS;
        }
    }

    async getLanguagePreferenceSettings(): Promise<LanguagePreferenceSettings> {
        const row = await this.db.getFirstAsync<AppSettingRow>(
            "SELECT value_json FROM app_settings WHERE key = ?",
            LANGUAGE_PREFERENCES_SETTINGS_KEY
        );

        if (!row) {
            return DEFAULT_LANGUAGE_PREFERENCE_SETTINGS;
        }

        try {
            return normalizeLanguagePreferenceSettings(
                textToJson<Partial<LanguagePreferenceSettings>>(row.value_json)
            );
        } catch {
            return DEFAULT_LANGUAGE_PREFERENCE_SETTINGS;
        }
    }

    async savePracticeReminderSettings(
        settings: PracticeReminderSettings
    ): Promise<void> {
        const normalized = normalizePracticeReminderSettings(settings);

        await this.saveJsonSetting(PRACTICE_REMINDER_SETTINGS_KEY, normalized);
    }

    async saveLanguagePreferenceSettings(
        settings: LanguagePreferenceSettings
    ): Promise<void> {
        const normalized = normalizeLanguagePreferenceSettings(settings);

        await this.saveJsonSetting(
            LANGUAGE_PREFERENCES_SETTINGS_KEY,
            normalized
        );
    }
}
