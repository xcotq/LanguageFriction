import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KnowledgeActionButton } from "@/components/knowledge/knowledge-action-button";
import { PracticeSummaryCard } from "@/components/practice/practice-summary-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import { useRepositories, type PracticeItemSummary } from "@/data/repositories";
import { useTheme } from "@/hooks/use-theme";

const CURRENT_USER_ID = "mock-user";

function pluralize(count: number, singular: string) {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export default function PracticeScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { practice } = useRepositories();
    const [summaries, setSummaries] = useState<PracticeItemSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string>();
    const duePracticeCount = summaries.filter(
        (summary) => summary.dueTargetCount > 0
    ).length;
    const answeredPracticeCount = summaries.filter(
        (summary) => summary.responseCount > 0
    ).length;

    const fetchPracticeItems = useCallback(async () => {
        return practice.listPracticeItemSummaries(CURRENT_USER_ID);
    }, [practice]);

    const loadPracticeItems = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(undefined);

        try {
            setSummaries(await fetchPracticeItems());
        } catch (error) {
            console.error("Failed to load practice items", error);
            setErrorMessage("Practice items could not be loaded.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchPracticeItems]);

    useEffect(() => {
        let isMounted = true;

        async function loadInitialPracticeItems() {
            try {
                const nextSummaries = await fetchPracticeItems();

                if (isMounted) {
                    setSummaries(nextSummaries);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load practice items", error);

                if (isMounted) {
                    setErrorMessage("Practice items could not be loaded.");
                    setIsLoading(false);
                }
            }
        }

        loadInitialPracticeItems();

        return () => {
            isMounted = false;
        };
    }, [fetchPracticeItems]);

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
                            Practice
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {isLoading
                                ? "Loading practice items"
                                : [
                                      pluralize(
                                          summaries.length,
                                          "practice item"
                                      ),
                                      duePracticeCount > 0
                                          ? `${duePracticeCount} due`
                                          : undefined,
                                      answeredPracticeCount > 0
                                          ? `${answeredPracticeCount} answered`
                                          : undefined,
                                  ]
                                      .filter(Boolean)
                                      .join(", ")}
                        </ThemedText>
                    </View>

                    <KnowledgeActionButton
                        label="Refresh"
                        loading={isLoading}
                        onPress={loadPracticeItems}
                        variant="secondary"
                    />
                </View>

                {errorMessage ? (
                    <ThemedText selectable type="small" style={styles.error}>
                        {errorMessage}
                    </ThemedText>
                ) : null}

                <View style={styles.list}>
                    {summaries.map((summary) => (
                        <PracticeSummaryCard
                            key={summary.item.id}
                            summary={summary}
                        />
                    ))}

                    {!isLoading && summaries.length === 0 ? (
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            No practice items yet. Generate practice data from a
                            knowledge point first.
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
    list: {
        gap: Spacing.two,
    },
    error: {
        color: "#c2410c",
    },
});
