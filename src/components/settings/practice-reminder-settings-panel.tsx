import { Pressable, StyleSheet, Switch, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { usePracticeReminderState } from "@/providers/practice-reminder-state";

function formatLastCheckedAt(value?: Date) {
    if (!value) {
        return "Not checked yet";
    }

    return `Last checked ${value.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })}`;
}

export function PracticeReminderSettingsPanel() {
    const theme = useTheme();
    const {
        dueTargetCount,
        isChecking,
        isLoading,
        isSaving,
        lastCheckedAt,
        refreshDueTargets,
        setEnabled,
        settings,
    } = usePracticeReminderState();
    const disabled = isLoading || isSaving;

    return (
        <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.panelHeader}>
                <View style={styles.headerText}>
                    <ThemedText selectable type="smallBold">
                        Practice reminder
                    </ThemedText>
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        Show a top reminder when learning targets are due.
                    </ThemedText>
                </View>
                <Switch
                    value={settings.enabled}
                    disabled={disabled}
                    onValueChange={setEnabled}
                    thumbColor={settings.enabled ? "#ffffff" : undefined}
                    trackColor={{
                        false: theme.backgroundSelected,
                        true: "#2f6fed",
                    }}
                />
            </View>

            <View style={styles.statusRow}>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {settings.enabled
                        ? `${dueTargetCount} due target${dueTargetCount === 1 ? "" : "s"}`
                        : "Reminder is off"}
                </ThemedText>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {formatLastCheckedAt(lastCheckedAt)}
                </ThemedText>
            </View>

            <Pressable
                accessibilityRole="button"
                disabled={!settings.enabled || isChecking}
                onPress={refreshDueTargets}
                style={({ pressed }) => [
                    styles.refreshButton,
                    pressed && styles.pressed,
                    (!settings.enabled || isChecking) && styles.disabled,
                ]}
            >
                <ThemedText type="smallBold" style={styles.refreshButtonText}>
                    {isChecking ? "Checking" : "Check now"}
                </ThemedText>
            </Pressable>
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
        gap: Spacing.three,
    },
    headerText: {
        flex: 1,
        gap: Spacing.one,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    refreshButton: {
        minHeight: 38,
        alignSelf: "flex-start",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
    },
    refreshButtonText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.74,
    },
    disabled: {
        opacity: 0.6,
    },
});
