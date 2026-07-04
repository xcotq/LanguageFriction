import type { SQLiteDatabase } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

export type LanguageFrictionDrizzleDatabase = ReturnType<typeof getDrizzleDb>;

export function getDrizzleDb(db: SQLiteDatabase) {
  return drizzle(db, { schema });
}
