import { Pressable, StyleSheet, View } from "react-native";

import {
    SUPPORTED_LANGUAGE_OPTIONS,
    type SupportedLanguageCode,
} from "@/constants/language-preferences";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useLanguagePreferenceState } from "@/providers/language-preference-state";

type LanguageOptionGroupProps = {
    disabled: boolean;
    label: string;
    onSelect: (language: SupportedLanguageCode) => Promise<void>;
    selectedLanguage: SupportedLanguageCode;
};

function LanguageOptionGroup({
    disabled,
    label,
    onSelect,
    selectedLanguage,
}: LanguageOptionGroupProps) {
    const theme = useTheme();

    return (
        <View style={styles.fieldGroup}>
            <ThemedText selectable type="smallBold">
                {label}
            </ThemedText>
            <View style={styles.optionGrid}>
                {SUPPORTED_LANGUAGE_OPTIONS.map((option) => {
                    const selected = option.code === selectedLanguage;

                    return (
                        <Pressable
                            key={option.code}
                            accessibilityRole="button"
                            accessibilityState={{
                                disabled: disabled || selected,
                                selected,
                            }}
                            disabled={disabled || selected}
                            onPress={() => {
                                void onSelect(option.code).catch((error) => {
                                    console.error(
                                        "Failed to save language preference",
                                        error
                                    );
                                });
                            }}
                            style={({ pressed }) => [
                                styles.optionButton,
                                {
                                    backgroundColor: selected
                                        ? "#2f6fed"
                                        : theme.background,
                                    borderColor: selected
                                        ? "#2f6fed"
                                        : theme.backgroundSelected,
                                },
                                pressed && styles.pressed,
                                disabled && styles.disabled,
                            ]}
                        >
                            <ThemedText
                                type="smallBold"
                                style={selected && styles.selectedOptionText}
                            >
                                {option.label}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

export function LanguagePreferenceSettingsPanel() {
    const {
        isLoading,
        isSaving,
        setLearningLanguage,
        setPrimaryLanguage,
        settings,
    } = useLanguagePreferenceState();
    const disabled = isLoading || isSaving;

    return (
        <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.panelHeader}>
                <View style={styles.headerText}>
                    <ThemedText selectable type="smallBold">
                        Language preferences
                    </ThemedText>
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        Used to interpret questions and shape language-use
                        answers.
                    </ThemedText>
                </View>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {isLoading
                        ? "Loading"
                        : isSaving
                          ? "Saving"
                          : "Stored on this device"}
                </ThemedText>
            </View>

            <LanguageOptionGroup
                disabled={disabled}
                label="Primary language"
                selectedLanguage={settings.primaryLanguage}
                onSelect={setPrimaryLanguage}
            />
            <LanguageOptionGroup
                disabled={disabled}
                label="Learning language"
                selectedLanguage={settings.learningLanguage}
                onSelect={setLearningLanguage}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    panel: {
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    panelHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    headerText: {
        flex: 1,
        gap: Spacing.one,
    },
    fieldGroup: {
        gap: Spacing.one,
    },
    optionGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    optionButton: {
        minHeight: 38,
        minWidth: 94,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.three,
    },
    selectedOptionText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.74,
    },
    disabled: {
        opacity: 0.6,
    },
});
