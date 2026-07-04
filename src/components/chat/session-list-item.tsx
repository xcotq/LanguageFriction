import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ChatSession } from "@/types/domain";

type SessionListItemProps = {
    session: ChatSession;
    isSelected?: boolean;
    onPress?: () => void;
    onDelete?: () => void;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

export function SessionListItem({
    session,
    isSelected = false,
    onPress,
    onDelete,
}: SessionListItemProps) {
    const theme = useTheme();

    return (
        <ThemedView
            type={isSelected ? "backgroundSelected" : "backgroundElement"}
            style={[styles.container, isSelected && { borderColor: "#2f6fed" }]}
        >
            <Pressable
                accessibilityRole="button"
                onPress={onPress}
                style={({ pressed }) => [
                    styles.detailsButton,
                    pressed && styles.pressed,
                ]}
            >
                <View style={styles.header}>
                    <View style={styles.titleGroup}>
                        <ThemedText
                            selectable
                            type="smallBold"
                            style={styles.title}
                        >
                            {session.title ?? "Untitled session"}
                        </ThemedText>
                        {isSelected ? (
                            <ThemedText
                                selectable
                                type="small"
                                themeColor="textSecondary"
                            >
                                Current
                            </ThemedText>
                        ) : null}
                    </View>
                    <View style={styles.metaGroup}>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {dateFormatter.format(session.lastMessageAt)}
                        </ThemedText>
                    </View>
                </View>
                <View style={styles.footer}>
                    <View
                        style={[
                            styles.statusDot,
                            {
                                backgroundColor:
                                    session.status === "active"
                                        ? "#2f6fed"
                                        : theme.textSecondary,
                            },
                        ]}
                    />
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        {session.status}
                    </ThemedText>
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        {session.messages.length} messages
                    </ThemedText>
                </View>
            </Pressable>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${session.title ?? "untitled session"}`}
                onPress={onDelete}
                style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.pressed,
                ]}
            >
                <ThemedText type="smallBold" style={styles.deleteButtonText}>
                    Delete
                </ThemedText>
            </Pressable>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    pressed: {
        opacity: 0.72,
    },
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.two,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    detailsButton: {
        flex: 1,
        gap: Spacing.two,
        padding: Spacing.three,
    },
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: Spacing.two,
    },
    titleGroup: {
        flex: 1,
        gap: Spacing.one,
    },
    title: {
        flex: 1,
    },
    metaGroup: {
        alignItems: "flex-end",
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.two,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
    },
    deleteButton: {
        minHeight: 40,
        minWidth: 72,
        alignItems: "center",
        justifyContent: "center",
        marginRight: Spacing.two,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(196, 47, 47, 0.35)",
        backgroundColor: "rgba(196, 47, 47, 0.12)",
    },
    deleteButtonText: {
        color: "#c42f2f",
    },
});
