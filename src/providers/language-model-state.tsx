import {
    createContext,
    type PropsWithChildren,
    use,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    defaultLanguageModelSettings,
    isLanguageModelConfigured,
    loadLanguageModelSettings,
    saveLanguageModelSettings,
    type LanguageModelSettings,
    type LanguageModelStatus,
} from "@/providers/language-model-provider";

type LanguageModelState = {
    settings: LanguageModelSettings;
    status: LanguageModelStatus;
    isLoading: boolean;
    isSaving: boolean;
    revision: number;
    refreshSettings: () => Promise<void>;
    saveSettings: (settings: LanguageModelSettings) => Promise<void>;
};

const LanguageModelStateContext = createContext<LanguageModelState | null>(
    null
);

function createLanguageModelStatus(
    settings: LanguageModelSettings
): LanguageModelStatus {
    const configured = isLanguageModelConfigured(settings);

    return {
        configured,
        modelName: settings.modelName,
        label: configured ? settings.modelName : "Mock mode",
    };
}

export function LanguageModelStateProvider({ children }: PropsWithChildren) {
    const [settings, setSettings] = useState<LanguageModelSettings>(
        defaultLanguageModelSettings
    );
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [revision, setRevision] = useState(0);

    const refreshSettings = useCallback(async () => {
        setIsLoading(true);

        try {
            setSettings(await loadLanguageModelSettings());
            setRevision((current) => current + 1);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveSettings = useCallback(
        async (nextSettings: LanguageModelSettings) => {
            setIsSaving(true);

            try {
                await saveLanguageModelSettings(nextSettings);
                setSettings(nextSettings);
                setRevision((current) => current + 1);
            } finally {
                setIsSaving(false);
            }
        },
        []
    );

    useEffect(() => {
        let isMounted = true;

        loadLanguageModelSettings()
            .then((storedSettings) => {
                if (isMounted) {
                    setSettings(storedSettings);
                    setRevision((current) => current + 1);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const status = useMemo(
        () => createLanguageModelStatus(settings),
        [settings]
    );

    const value = useMemo<LanguageModelState>(
        () => ({
            settings,
            status,
            isLoading,
            isSaving,
            revision,
            refreshSettings,
            saveSettings,
        }),
        [
            isLoading,
            isSaving,
            refreshSettings,
            revision,
            saveSettings,
            settings,
            status,
        ]
    );

    return (
        <LanguageModelStateContext value={value}>
            {children}
        </LanguageModelStateContext>
    );
}

export function useLanguageModelState() {
    const context = use(LanguageModelStateContext);

    if (!context) {
        throw new Error(
            "useLanguageModelState must be used inside LanguageModelStateProvider."
        );
    }

    return context;
}
