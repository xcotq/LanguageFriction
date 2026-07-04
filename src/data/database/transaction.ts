import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

export async function runWriteTransaction<T>(
  db: SQLiteDatabase,
  task: (tx: SQLiteDatabase) => Promise<T>
): Promise<T> {
  let result: T | undefined;

  if (Platform.OS === "web") {
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
  } else {
    await db.withExclusiveTransactionAsync(async (tx) => {
      result = await task(tx);
    });
  }

  return result as T;
}
