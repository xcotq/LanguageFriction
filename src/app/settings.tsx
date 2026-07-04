import { useRef } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageModelSettingsPanel } from "@/components/settings/language-model-settings-panel";
import { PracticeReminderSettingsPanel } from "@/components/settings/practice-reminder-settings-panel";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function SettingsScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);

    function handleSettingsFieldFocus(contentY: number) {
        setTimeout(() => {
            scrollRef.current?.scrollTo({
                y: Math.max(contentY - Spacing.three, 0),
                animated: true,
            });
        }, 120);
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.keyboardView, { backgroundColor: theme.background }]}
        >
            <ScrollView
                ref={scrollRef}
                style={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + TopTabInset,
                        paddingBottom: insets.bottom + Spacing.four,
                    },
                ]}
            >
                <ThemedView style={styles.container}>
                    <View style={styles.header}>
                        <ThemedText selectable type="subtitle">
                            Settings
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            Model provider and reminders
                        </ThemedText>
                    </View>

                    <LanguageModelSettingsPanel
                        onFieldFocus={handleSettingsFieldFocus}
                    />
                    <PracticeReminderSettingsPanel />
                </ThemedView>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: Spacing.three,
        alignItems: "center",
    },
    container: {
        width: "100%",
        maxWidth: MaxContentWidth,
        gap: Spacing.three,
    },
    header: {
        gap: Spacing.one,
    },
});
