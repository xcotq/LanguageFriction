import { useState } from "react";
import {
    Keyboard,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    type LayoutChangeEvent,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useLanguageModelState } from "@/providers/language-model-state";
import type {
    LanguageModelSettings,
    LanguageModelStatus,
} from "@/providers/language-model-provider";

type LanguageModelSettingsFormProps = {
    activeSettings: LanguageModelSettings;
    isLoading: boolean;
    isSaving: boolean;
    onFieldFocus?: (contentY: number) => void;
    saveSettings: (settings: LanguageModelSettings) => Promise<void>;
    status: LanguageModelStatus;
};

type SettingsField = "apiKey" | "endpoint" | "modelName";

export function LanguageModelSettingsPanel({
    onFieldFocus,
}: {
    onFieldFocus?: (contentY: number) => void;
}) {
    const {
        isLoading,
        isSaving,
        revision,
        saveSettings,
        settings: activeSettings,
        status,
    } = useLanguageModelState();

    return (
        <LanguageModelSettingsForm
            key={revision}
            activeSettings={activeSettings}
            isLoading={isLoading}
            isSaving={isSaving}
            onFieldFocus={onFieldFocus}
            saveSettings={saveSettings}
            status={status}
        />
    );
}

function LanguageModelSettingsForm({
    activeSettings,
    isLoading,
    isSaving,
    onFieldFocus,
    saveSettings,
    status,
}: LanguageModelSettingsFormProps) {
    const theme = useTheme();
    const [panelY, setPanelY] = useState(0);
    const [fieldYByName, setFieldYByName] = useState<Record<SettingsField, number>>({
        apiKey: 0,
        endpoint: 0,
        modelName: 0,
    });
    const [settings, setSettings] =
        useState<LanguageModelSettings>(activeSettings);
    const [savedState, setSavedState] = useState<
        "idle" | "saving" | "saved" | "error"
    >("idle");

    async function handleSave() {
        Keyboard.dismiss();
        setSavedState("saving");

        try {
            await saveSettings(settings);
            setSavedState("saved");
            setTimeout(() => setSavedState("idle"), 1800);
        } catch {
            setSavedState("error");
        }
    }

    function handlePanelLayout(event: LayoutChangeEvent) {
        setPanelY(event.nativeEvent.layout.y);
    }

    function handleFieldLayout(field: SettingsField) {
        return (event: LayoutChangeEvent) => {
            const y = event.nativeEvent.layout.y;

            setFieldYByName((current) => ({ ...current, [field]: y }));
        };
    }

    function handleFieldFocus(field: SettingsField) {
        onFieldFocus?.(panelY + fieldYByName[field]);
    }

    return (
        <ThemedView
            type="backgroundElement"
            style={styles.panel}
            onLayout={handlePanelLayout}
        >
            <View style={styles.panelHeader}>
                <ThemedText selectable type="smallBold">
                    Model settings
                </ThemedText>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {isLoading ? "Loading" : status.label}
                </ThemedText>
            </View>

            <View
                style={styles.fieldGroup}
                onLayout={handleFieldLayout("endpoint")}
            >
                <ThemedText selectable type="smallBold">
                    Endpoint
                </ThemedText>
                <TextInput
                    value={settings.endpoint}
                    onChangeText={(endpoint) =>
                        setSettings((current) => ({ ...current, endpoint }))
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => handleFieldFocus("endpoint")}
                    placeholder="https://api.openai.com/v1"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                        styles.input,
                        {
                            color: theme.text,
                            borderColor: theme.backgroundSelected,
                            backgroundColor: theme.background,
                        },
                    ]}
                />
            </View>

            <View
                style={styles.fieldGroup}
                onLayout={handleFieldLayout("apiKey")}
            >
                <ThemedText selectable type="smallBold">
                    API key
                </ThemedText>
                <TextInput
                    value={settings.apiKey}
                    onChangeText={(apiKey) =>
                        setSettings((current) => ({ ...current, apiKey }))
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => handleFieldFocus("apiKey")}
                    secureTextEntry
                    placeholder="sk-..."
                    placeholderTextColor={theme.textSecondary}
                    style={[
                        styles.input,
                        {
                            color: theme.text,
                            borderColor: theme.backgroundSelected,
                            backgroundColor: theme.background,
                        },
                    ]}
                />
            </View>

            <View
                style={styles.fieldGroup}
                onLayout={handleFieldLayout("modelName")}
            >
                <ThemedText selectable type="smallBold">
                    Model
                </ThemedText>
                <TextInput
                    value={settings.modelName}
                    onChangeText={(modelName) =>
                        setSettings((current) => ({ ...current, modelName }))
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => handleFieldFocus("modelName")}
                    placeholder="gpt-4.1-mini"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                        styles.input,
                        {
                            color: theme.text,
                            borderColor: theme.backgroundSelected,
                            backgroundColor: theme.background,
                        },
                    ]}
                />
            </View>

            <View style={styles.actions}>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {savedState === "error"
                        ? "Save failed"
                        : savedState === "saved"
                          ? "Saved"
                          : "Stored on this device"}
                </ThemedText>
                <Pressable
                    accessibilityRole="button"
                    onPress={handleSave}
                    disabled={isLoading || isSaving || savedState === "saving"}
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.pressed,
                        (isLoading || isSaving || savedState === "saving") &&
                            styles.disabled,
                    ]}
                >
                    <ThemedText type="smallBold" style={styles.saveButtonText}>
                        {isSaving || savedState === "saving"
                            ? "Saving"
                            : "Save"}
                    </ThemedText>
                </Pressable>
            </View>
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
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.two,
    },
    fieldGroup: {
        gap: Spacing.one,
    },
    input: {
        minHeight: 46,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.three,
        fontSize: 16,
        lineHeight: 22,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.two,
    },
    saveButton: {
        minHeight: 38,
        minWidth: 82,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
    },
    saveButtonText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.74,
    },
    disabled: {
        opacity: 0.6,
    },
});
