import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";

import {
    DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    type LanguagePreferenceSettings,
    type SupportedLanguageCode,
} from "@/constants/language-preferences";
import { useRepositories } from "@/data/repositories";

type LanguagePreferenceState = {
    isLoading: boolean;
    isSaving: boolean;
    setLearningLanguage: (language: SupportedLanguageCode) => Promise<void>;
    setPrimaryLanguage: (language: SupportedLanguageCode) => Promise<void>;
    settings: LanguagePreferenceSettings;
};

const LanguagePreferenceStateContext =
    createContext<LanguagePreferenceState | null>(null);

export function LanguagePreferenceStateProvider({
    children,
}: PropsWithChildren) {
    const { appSettings } = useRepositories();
    const [settings, setSettings] = useState<LanguagePreferenceSettings>(
        DEFAULT_LANGUAGE_PREFERENCE_SETTINGS
    );
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const saveSettings = useCallback(
        async (nextSettings: LanguagePreferenceSettings) => {
            setIsSaving(true);

            try {
                await appSettings.saveLanguagePreferenceSettings(nextSettings);
                setSettings(nextSettings);
            } finally {
                setIsSaving(false);
            }
        },
        [appSettings]
    );

    const setPrimaryLanguage = useCallback(
        async (primaryLanguage: SupportedLanguageCode) => {
            await saveSettings({ ...settings, primaryLanguage });
        },
        [saveSettings, settings]
    );

    const setLearningLanguage = useCallback(
        async (learningLanguage: SupportedLanguageCode) => {
            await saveSettings({ ...settings, learningLanguage });
        },
        [saveSettings, settings]
    );

    useEffect(() => {
        let isMounted = true;

        async function loadSettings() {
            try {
                const nextSettings =
                    await appSettings.getLanguagePreferenceSettings();

                if (isMounted) {
                    setSettings(nextSettings);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load language preferences", error);

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

    const value = useMemo<LanguagePreferenceState>(
        () => ({
            isLoading,
            isSaving,
            setLearningLanguage,
            setPrimaryLanguage,
            settings,
        }),
        [isLoading, isSaving, setLearningLanguage, setPrimaryLanguage, settings]
    );

    return (
        <LanguagePreferenceStateContext value={value}>
            {children}
        </LanguagePreferenceStateContext>
    );
}

export function useLanguagePreferenceState() {
    const context = use(LanguagePreferenceStateContext);

    if (!context) {
        throw new Error(
            "useLanguagePreferenceState must be used inside LanguagePreferenceStateProvider."
        );
    }

    return context;
}
