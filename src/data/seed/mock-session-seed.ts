import type { SQLiteDatabase } from "expo-sqlite";

import { mockSessions } from "@/data/mock-sessions";
import { getLanguageFrictionRepositories } from "@/data/repositories/registry";

export async function seedMockSessions(db: SQLiteDatabase): Promise<void> {
    const { chatSession: repository } = getLanguageFrictionRepositories(db);

    for (const session of mockSessions) {
        await repository.saveSession(session);
    }
}
