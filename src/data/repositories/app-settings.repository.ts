import type { SQLiteDatabase } from "expo-sqlite";

import { dateToText, textToJson } from "@/data/database/serialization";

export type PracticeReminderSettings = {
    enabled: boolean;
    pollIntervalMs: number;
};

type AppSettingRow = {
    value_json: string;
};

const PRACTICE_REMINDER_SETTINGS_KEY = "practiceReminder";
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

export class AppSettingsRepository {
    constructor(private readonly db: SQLiteDatabase) {}

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

    async savePracticeReminderSettings(
        settings: PracticeReminderSettings
    ): Promise<void> {
        const normalized = normalizePracticeReminderSettings(settings);

        await this.db.runAsync(
            `
INSERT INTO app_settings (key, value_json, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at
`,
            PRACTICE_REMINDER_SETTINGS_KEY,
            JSON.stringify(normalized),
            dateToText(new Date())
        );
    }
}
