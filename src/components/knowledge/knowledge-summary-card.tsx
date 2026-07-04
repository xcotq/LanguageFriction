import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { KnowledgePointSummary } from "@/services/knowledge-practice";

import { DueTargetIndicator } from "./due-target-indicator";

type KnowledgeSummaryCardProps = {
    summary: KnowledgePointSummary;
};

function pluralize(count: number, singular: string) {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatDate(value?: Date) {
    if (!value) {
        return "No practice yet";
    }

    return `Last practice ${value.toLocaleDateString()}`;
}

export function KnowledgeSummaryCard({ summary }: KnowledgeSummaryCardProps) {
    return (
        <Link
            href={{
                pathname: "/knowledge/[knowledgePointId]",
                params: { knowledgePointId: summary.knowledgePoint.id },
            }}
            asChild
        >
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.card}>
                    <View style={styles.mainContent}>
                        <View style={styles.titleRow}>
                            <ThemedText
                                selectable
                                type="smallBold"
                                style={styles.titleText}
                            >
                                {summary.knowledgePoint.title}
                            </ThemedText>
                            <DueTargetIndicator
                                compact
                                count={summary.dueTargetCount}
                            />
                        </View>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {summary.knowledgePoint.objective}
                        </ThemedText>
                        {summary.utterance ? (
                            <ThemedText selectable type="small">
                                {summary.utterance.text}
                            </ThemedText>
                        ) : null}
                    </View>

                    <View style={styles.metaRow}>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                            style={styles.metaText}
                        >
                            {pluralize(summary.expressionCount, "expression")}
                        </ThemedText>
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
                            themeColor="textSecondary"
                            style={styles.metaText}
                        >
                            {pluralize(summary.practiceItemCount, "practice")}
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                            style={styles.metaText}
                        >
                            {formatDate(summary.latestPracticeGeneratedAt)}
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
    mainContent: {
        gap: Spacing.one,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.two,
    },
    titleText: {
        flex: 1,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    metaText: {
        fontVariant: ["tabular-nums"],
    },
    pressed: {
        opacity: 0.72,
    },
});
