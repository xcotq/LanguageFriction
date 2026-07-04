import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { usePracticeReminderState } from "@/providers/practice-reminder-state";

export function PracticeDueReminderButton() {
    const { dueTargetCount, hasDueTargets, settings } =
        usePracticeReminderState();

    if (!settings.enabled || !hasDueTargets) {
        return null;
    }

    return (
        <Link href={"/knowledge" as Href} asChild>
            <Pressable
                accessibilityLabel={`${dueTargetCount} due learning targets`}
                accessibilityRole="button"
                style={({ pressed }) => pressed && styles.pressed}
            >
                <ThemedView type="backgroundSelected" style={styles.button}>
                    <View style={styles.dot} />
                    <ThemedText type="smallBold" style={styles.label}>
                        {dueTargetCount}
                    </ThemedText>
                </ThemedView>
            </Pressable>
        </Link>
    );
}

const styles = StyleSheet.create({
    button: {
        minWidth: 34,
        minHeight: 30,
        paddingHorizontal: Spacing.two,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.one,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#dc2626",
    },
    label: {
        color: "#dc2626",
        fontVariant: ["tabular-nums"],
    },
    pressed: {
        opacity: 0.72,
    },
});
