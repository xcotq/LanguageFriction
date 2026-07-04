import {
    openDatabaseAsync,
    type SQLiteDatabase,
    type SQLiteOpenOptions,
} from "expo-sqlite";

import { runMigrations } from "./migrations";
import { seedMockKnowledgePractice } from "@/data/seed/mock-knowledge-practice-seed";
import { seedMockSessions } from "@/data/seed/mock-session-seed";

export const LANGUAGE_FRICTION_DATABASE_NAME = "languagefriction.db";

export async function initializeLanguageFrictionDatabase(
    db: SQLiteDatabase
): Promise<void> {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;");
    await runMigrations(db);
    await seedMockSessions(db);
    await seedMockKnowledgePractice(db);
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
