import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KnowledgeActionButton } from "@/components/knowledge/knowledge-action-button";
import { KnowledgeSummaryCard } from "@/components/knowledge/knowledge-summary-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import { useRepositories } from "@/data/repositories";
import { type KnowledgePointSummary } from "@/services/knowledge-practice";
import { useTheme } from "@/hooks/use-theme";

const CURRENT_USER_ID = "mock-user";

export default function KnowledgeScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { knowledgePracticeSource } = useRepositories();
    const [summaries, setSummaries] = useState<KnowledgePointSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string>();
    const dueKnowledgePointCount = summaries.filter(
        (summary) => summary.dueTargetCount > 0
    ).length;

    const fetchKnowledgePoints = useCallback(async () => {
        return knowledgePracticeSource.listKnowledgePoints(CURRENT_USER_ID);
    }, [knowledgePracticeSource]);

    const loadKnowledgePoints = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(undefined);

        try {
            setSummaries(await fetchKnowledgePoints());
        } catch (error) {
            console.error("Failed to load knowledge points", error);
            setErrorMessage("Knowledge points could not be loaded.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchKnowledgePoints]);

    useEffect(() => {
        let isMounted = true;

        async function loadInitialKnowledgePoints() {
            try {
                const nextSummaries = await fetchKnowledgePoints();

                if (isMounted) {
                    setSummaries(nextSummaries);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load knowledge points", error);

                if (isMounted) {
                    setErrorMessage("Knowledge points could not be loaded.");
                    setIsLoading(false);
                }
            }
        }

        loadInitialKnowledgePoints();

        return () => {
            isMounted = false;
        };
    }, [fetchKnowledgePoints]);

    return (
        <ScrollView
            style={[styles.scrollView, { backgroundColor: theme.background }]}
            contentInsetAdjustmentBehavior="automatic"
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
                    <View style={styles.headerText}>
                        <ThemedText selectable type="subtitle">
                            Knowledge
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {isLoading
                                ? "Loading knowledge points"
                                : dueKnowledgePointCount > 0
                                  ? `${summaries.length} knowledge points · ${dueKnowledgePointCount} due`
                                  : `${summaries.length} knowledge points`}
                        </ThemedText>
                    </View>

                    <View style={styles.headerActions}>
                        <KnowledgeActionButton
                            label="Entities"
                            onPress={() => router.push("/knowledge/entities")}
                            variant="secondary"
                        />
                        <KnowledgeActionButton
                            label="Refresh"
                            loading={isLoading}
                            onPress={loadKnowledgePoints}
                            variant="secondary"
                        />
                    </View>
                </View>

                {errorMessage ? (
                    <ThemedText selectable type="small" style={styles.error}>
                        {errorMessage}
                    </ThemedText>
                ) : null}

                <View style={styles.list}>
                    {summaries.map((summary) => (
                        <KnowledgeSummaryCard
                            key={summary.knowledgePoint.id}
                            summary={summary}
                        />
                    ))}

                    {!isLoading && summaries.length === 0 ? (
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            No knowledge points yet. End a chat and confirm an
                            extraction to create one.
                        </ThemedText>
                    ) : null}
                </View>
            </ThemedView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    headerText: {
        flex: 1,
        gap: Spacing.one,
    },
    headerActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        gap: Spacing.two,
    },
    list: {
        gap: Spacing.two,
    },
    error: {
        color: "#c2410c",
    },
});
