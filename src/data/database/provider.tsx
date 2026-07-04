import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import type { PropsWithChildren } from "react";

import {
    initializeLanguageFrictionDatabase,
    LANGUAGE_FRICTION_DATABASE_NAME,
} from "./connection";
import { LanguageFrictionRepositoriesProvider } from "@/data/repositories/provider";

export function LanguageFrictionDatabaseProvider({
    children,
}: PropsWithChildren) {
    return (
        <SQLiteProvider
            databaseName={LANGUAGE_FRICTION_DATABASE_NAME}
            onInit={initializeLanguageFrictionDatabase}
        >
            <LanguageFrictionRepositoriesProvider>
                {children}
            </LanguageFrictionRepositoriesProvider>
        </SQLiteProvider>
    );
}

export function useLanguageFrictionDatabase() {
    return useSQLiteContext();
}
