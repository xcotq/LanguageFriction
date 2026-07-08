import {
    openDatabaseAsync,
    type SQLiteDatabase,
    type SQLiteOpenOptions,
} from "expo-sqlite";

import { runMigrations } from "./migrations";

export const LANGUAGE_FRICTION_DATABASE_NAME = "languagefriction.db";

const ENABLE_MOCK_DB_SEED_VALUES = new Set(["1", "true"]);

export function isMockDatabaseSeedEnabled() {
    return ENABLE_MOCK_DB_SEED_VALUES.has(
        process.env.EXPO_PUBLIC_ENABLE_MOCK_DB_SEED?.trim().toLowerCase() ?? ""
    );
}

async function seedMockDatabase(db: SQLiteDatabase) {
    const [{ seedMockSessions }, { seedMockKnowledgePractice }] =
        await Promise.all([
            import("@/data/seed/mock-session-seed"),
            import("@/data/seed/mock-knowledge-practice-seed"),
        ]);

    await seedMockSessions(db);
    await seedMockKnowledgePractice(db);
}

export async function initializeLanguageFrictionDatabase(
    db: SQLiteDatabase
): Promise<void> {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;");
    await runMigrations(db);

    if (isMockDatabaseSeedEnabled()) {
        await seedMockDatabase(db);
    }
}

export async function openLanguageFrictionDatabase(
    options?: SQLiteOpenOptions
): Promise<SQLiteDatabase> {
    const db = await openDatabaseAsync(
        LANGUAGE_FRICTION_DATABASE_NAME,
        options
    );
    await initializeLanguageFrictionDatabase(db);
    return db;
}
