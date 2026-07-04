import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { PracticeItemSummary } from "@/data/repositories";

import {
    formatDate,
    formatDateTime,
    formatPracticeItemType,
    formatPracticePromptSummary,
} from "./practice-format";

type PracticeSummaryCardProps = {
    summary: PracticeItemSummary;
};

function pluralize(count: number, singular: string) {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatResponseMeta(summary: PracticeItemSummary) {
    if (summary.responseCount === 0) {
        return "Not answered";
    }

    return summary.latestSubmittedAt
        ? `Answered ${formatDate(summary.latestSubmittedAt)}`
        : pluralize(summary.responseCount, "answer");
}

export function PracticeSummaryCard({ summary }: PracticeSummaryCardProps) {
    return (
        <Link
            href={{
                pathname: "/practice/[practiceItemId]",
                params: { practiceItemId: summary.item.id },
            }}
            asChild
        >
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.card}>
                    <View style={styles.headerRow}>
                        <View style={styles.titleColumn}>
                            <View style={styles.titleRow}>
                                <ThemedText
                                    selectable
                                    type="smallBold"
                                    style={styles.promptText}
                                >
                                    {formatPracticePromptSummary(
                                        summary.item.prompt
                                    )}
                                </ThemedText>
                                {summary.dueTargetCount > 0 ? (
                                    <View style={styles.dueDot} />
                                ) : null}
                            </View>
                            <ThemedText
                                selectable
                                type="small"
                                themeColor="textSecondary"
                            >
                                {formatDateTime(summary.item.generatedAt)}
                            </ThemedText>
                        </View>

                        <ThemedView
                            type="backgroundSelected"
                            style={styles.typeBadge}
                        >
                            <ThemedText selectable type="smallBold">
                                {formatPracticeItemType(summary.item.type)}
                            </ThemedText>
                        </ThemedView>
                    </View>

                    <View style={styles.metaRow}>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                            style={styles.metaText}
                        >
                            {pluralize(summary.targetCount, "target")}
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor={
                                summary.dueTargetCount > 0
                                    ? undefined
                                    : "textSecondary"
                            }
                            style={[
                                styles.metaText,
                                summary.dueTargetCount > 0 && styles.dueText,
                            ]}
                        >
                            {summary.dueTargetCount > 0
                                ? `${summary.dueTargetCount} due`
                                : "No due targets"}
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                            style={styles.metaText}
                        >
                            {formatResponseMeta(summary)}
                        </ThemedText>
                    </View>
                </ThemedView>
            </Pressable>
        </Link>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    titleColumn: {
        flex: 1,
        gap: Spacing.one,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.two,
    },
    promptText: {
        flex: 1,
    },
    typeBadge: {
        flexShrink: 0,
        borderRadius: 8,
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.two,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    metaText: {
        fontVariant: ["tabular-nums"],
    },
    dueDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#dc2626",
    },
    dueText: {
        color: "#dc2626",
    },
    pressed: {
        opacity: 0.72,
    },
});
