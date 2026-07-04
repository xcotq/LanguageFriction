import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

type DueTargetIndicatorProps = {
    count: number;
    compact?: boolean;
};

export function DueTargetIndicator({
    compact = false,
    count,
}: DueTargetIndicatorProps) {
    if (count <= 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.dot} />
            <ThemedText selectable type="small" style={styles.text}>
                {compact ? count : `${count} due`}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.one,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#dc2626",
    },
    text: {
        color: "#dc2626",
        fontVariant: ["tabular-nums"],
    },
});
