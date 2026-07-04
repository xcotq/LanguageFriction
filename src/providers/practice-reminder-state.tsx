import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";

import { useRepositories } from "@/data/repositories";
import type { PracticeReminderSettings } from "@/data/repositories";
import type { LearningTarget } from "@/types/domain";

const CURRENT_USER_ID = "mock-user";

type PracticeReminderState = {
    dueKnowledgePointIds: ReadonlySet<string>;
    dueTargetCount: number;
    hasDueTargets: boolean;
    isChecking: boolean;
    isLoading: boolean;
    isSaving: boolean;
    lastCheckedAt?: Date;
    refreshDueTargets: () => Promise<void>;
    setEnabled: (enabled: boolean) => Promise<void>;
    settings: PracticeReminderSettings;
};

const DEFAULT_PRACTICE_REMINDER_SETTINGS: PracticeReminderSettings = {
    enabled: true,
    pollIntervalMs: 60_000,
};

const PracticeReminderStateContext =
    createContext<PracticeReminderState | null>(null);

export function PracticeReminderStateProvider({ children }: PropsWithChildren) {
    const { appSettings, practice } = useRepositories();
    const [settings, setSettings] = useState<PracticeReminderSettings>(
        DEFAULT_PRACTICE_REMINDER_SETTINGS
    );
    const [dueTargets, setDueTargets] = useState<LearningTarget[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isChecking, setIsChecking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date>();

    const loadDueTargets = useCallback(async () => {
        try {
            const nextTargets = await practice.getDueTargets(
                CURRENT_USER_ID,
                new Date(),
                100
            );

            setDueTargets(nextTargets);
            setLastCheckedAt(new Date());
        } catch (error) {
            console.error("Failed to check due learning targets", error);
        }
    }, [practice]);

    const refreshDueTargets = useCallback(async () => {
        setIsChecking(true);

        try {
            await loadDueTargets();
        } finally {
            setIsChecking(false);
        }
    }, [loadDueTargets]);

    const setEnabled = useCallback(
        async (enabled: boolean) => {
            const nextSettings = { ...settings, enabled };

            setIsSaving(true);

            try {
                await appSettings.savePracticeReminderSettings(nextSettings);
                setSettings(nextSettings);

                if (enabled) {
                    await loadDueTargets();
                } else {
                    setDueTargets([]);
                }
            } finally {
                setIsSaving(false);
            }
        },
        [appSettings, loadDueTargets, settings]
    );

    useEffect(() => {
        let isMounted = true;

        async function loadSettings() {
            try {
                const nextSettings =
                    await appSettings.getPracticeReminderSettings();

                if (isMounted) {
                    setSettings(nextSettings);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error(
                    "Failed to load practice reminder settings",
                    error
                );

                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadSettings();

        return () => {
            isMounted = false;
        };
    }, [appSettings]);

    useEffect(() => {
        if (isLoading || !settings.enabled) {
            return;
        }

        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        function scheduleNextCheck() {
            if (!isMounted) {
                return;
            }

            timeoutId = setTimeout(() => {
                void runCheck();
            }, settings.pollIntervalMs);
        }

        async function runCheck() {
            await loadDueTargets();
            scheduleNextCheck();
        }

        void runCheck();

        return () => {
            isMounted = false;

            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isLoading, loadDueTargets, settings.enabled, settings.pollIntervalMs]);

    const dueKnowledgePointIds = useMemo(() => {
        return new Set(
            dueTargets.flatMap((target) =>
                target.knowledgePointId ? [target.knowledgePointId] : []
            )
        );
    }, [dueTargets]);

    const value = useMemo<PracticeReminderState>(
        () => ({
            dueKnowledgePointIds,
            dueTargetCount: dueTargets.length,
            hasDueTargets: dueTargets.length > 0,
            isChecking,
            isLoading,
            isSaving,
            lastCheckedAt,
            refreshDueTargets,
            setEnabled,
            settings,
        }),
        [
            dueKnowledgePointIds,
            dueTargets.length,
            isChecking,
            isLoading,
            isSaving,
            lastCheckedAt,
            refreshDueTargets,
            setEnabled,
            settings,
        ]
    );

    return (
        <PracticeReminderStateContext.Provider value={value}>
            {children}
        </PracticeReminderStateContext.Provider>
    );
}

export function usePracticeReminderState() {
    const value = useContext(PracticeReminderStateContext);

    if (!value) {
        throw new Error(
            "usePracticeReminderState must be used within PracticeReminderStateProvider"
        );
    }

    return value;
}
