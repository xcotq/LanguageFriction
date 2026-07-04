import { useSQLiteContext } from "expo-sqlite";
import { createContext, type PropsWithChildren, use, useMemo } from "react";

import {
    getLanguageFrictionRepositories,
    type LanguageFrictionRepositories,
} from "./registry";

const LanguageFrictionRepositoriesContext =
    createContext<LanguageFrictionRepositories | null>(null);

export function LanguageFrictionRepositoriesProvider({
    children,
}: PropsWithChildren) {
    const db = useSQLiteContext();
    const repositories = useMemo(
        () => getLanguageFrictionRepositories(db),
        [db]
    );

    return (
        <LanguageFrictionRepositoriesContext value={repositories}>
            {children}
        </LanguageFrictionRepositoriesContext>
    );
}

export function useRepositories() {
    const repositories = use(LanguageFrictionRepositoriesContext);

    if (!repositories) {
        throw new Error(
            "useRepositories must be used inside LanguageFrictionRepositoriesProvider."
        );
    }

    return repositories;
}
