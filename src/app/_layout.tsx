import "@/polyfills";

import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { LanguageFrictionDatabaseProvider } from "@/data/database";
import { LanguageModelStateProvider } from "@/providers/language-model-state";
import { LanguagePreferenceStateProvider } from "@/providers/language-preference-state";
import { PracticeReminderStateProvider } from "@/providers/practice-reminder-state";

export default function TabLayout() {
    const colorScheme = useColorScheme();
    return (
        <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
            <LanguageFrictionDatabaseProvider>
                <LanguageModelStateProvider>
                    <LanguagePreferenceStateProvider>
                        <PracticeReminderStateProvider>
                            <AnimatedSplashOverlay />
                            <AppTabs />
                        </PracticeReminderStateProvider>
                    </LanguagePreferenceStateProvider>
                </LanguageModelStateProvider>
            </LanguageFrictionDatabaseProvider>
        </ThemeProvider>
    );
}
