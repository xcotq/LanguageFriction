import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DueTargetIndicator } from "@/components/knowledge/due-target-indicator";
import { KnowledgeActionButton } from "@/components/knowledge/knowledge-action-button";
import { KnowledgeDetailSection } from "@/components/knowledge/knowledge-detail-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import { useRepositories } from "@/data/repositories";
import {
    type KnowledgePointPracticeSource,
    type KnowledgePointSummary,
} from "@/services/knowledge-practice";
import { useTheme } from "@/hooks/use-theme";
import { usePracticeReminderState } from "@/providers/practice-reminder-state";

const CURRENT_USER_ID = "mock-user";

type ActionState = "idle" | "targets" | "practice";

function formatCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatContext(context: Record<string, unknown>) {
    const entries = Object.entries(context);

    if (entries.length === 0) {
        return "No context snapshot.";
    }

    return JSON.stringify(context, null, 2);
}

export default function KnowledgePointDetailScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { refreshDueTargets } = usePracticeReminderState();
    const params = useLocalSearchParams<{ knowledgePointId?: string }>();
    const knowledgePointId =
        typeof params.knowledgePointId === "string"
            ? params.knowledgePointId
            : undefined;
    const {
        knowledgePracticeSource,
        learningTargetGeneration,
        practiceItemGeneration,
    } = useRepositories();
    const [source, setSource] = useState<KnowledgePointPracticeSource | null>(
        null
    );
    const [summary, setSummary] = useState<KnowledgePointSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionState, setActionState] = useState<ActionState>("idle");
    const [resultMessage, setResultMessage] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string>();

    const fetchKnowledgePoint = useCallback(async () => {
        if (!knowledgePointId) {
            return {
                source: null,
                summary: null,
                errorMessage: "Missing knowledge point id.",
            };
        }

        const [nextSource, nextSummary] = await Promise.all([
            knowledgePracticeSource.getSource(
                knowledgePointId,
                CURRENT_USER_ID
            ),
            knowledgePracticeSource.getSummary(
                knowledgePointId,
                CURRENT_USER_ID
            ),
        ]);

        return {
            source: nextSource,
            summary: nextSummary,
            errorMessage: nextSource ? undefined : "Knowledge point not found.",
        };
    }, [knowledgePointId, knowledgePracticeSource]);

    const loadKnowledgePoint = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(undefined);

        try {
            const next = await fetchKnowledgePoint();

            setSource(next.source);
            setSummary(next.summary);
            setErrorMessage(next.errorMessage);
        } catch (error) {
            console.error("Failed to load knowledge point", error);
            setErrorMessage("Knowledge point could not be loaded.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchKnowledgePoint]);

    useEffect(() => {
        let isMounted = true;

        async function loadInitialKnowledgePoint() {
            try {
                const next = await fetchKnowledgePoint();

                if (isMounted) {
                    setSource(next.source);
                    setSummary(next.summary);
                    setErrorMessage(next.errorMessage);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load knowledge point", error);

                if (isMounted) {
                    setErrorMessage("Knowledge point could not be loaded.");
                    setIsLoading(false);
                }
            }
        }

        loadInitialKnowledgePoint();

        return () => {
            isMounted = false;
        };
    }, [fetchKnowledgePoint]);

    const handleGenerateTargets = useCallback(async () => {
        if (!knowledgePointId) {
            return;
        }

        setActionState("targets");
        setResultMessage(undefined);
        setErrorMessage(undefined);

        try {
            const result =
                await learningTargetGeneration.generateForKnowledgePoint({
                    userId: CURRENT_USER_ID,
                    knowledgePointId,
                });

            setResultMessage(
                `${formatCount(result.targets.length, "target")} ready`
            );
            await loadKnowledgePoint();
            await refreshDueTargets();
        } catch (error) {
            console.error("Failed to generate targets", error);
            setErrorMessage("Targets could not be generated.");
        } finally {
            setActionState("idle");
        }
    }, [
        knowledgePointId,
        learningTargetGeneration,
        loadKnowledgePoint,
        refreshDueTargets,
    ]);

    const handleGeneratePractice = useCallback(async () => {
        if (!knowledgePointId) {
            return;
        }

        setActionState("practice");
        setResultMessage(undefined);
        setErrorMessage(undefined);

        try {
            const drafts =
                await practiceItemGeneration.generateForKnowledgePoint({
                    userId: CURRENT_USER_ID,
                    knowledgePointId,
                });

            setResultMessage(
                `${formatCount(drafts.length, "practice item")} generated`
            );
            await loadKnowledgePoint();
        } catch (error) {
            console.error("Failed to generate practice items", error);
            setErrorMessage("Practice data could not be generated.");
        } finally {
            setActionState("idle");
        }
    }, [knowledgePointId, loadKnowledgePoint, practiceItemGeneration]);

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
                        <View style={styles.titleRow}>
                            <ThemedText
                                selectable
                                type="subtitle"
                                style={styles.titleText}
                            >
                                {source?.knowledgePoint.title ??
                                    "Knowledge point"}
                            </ThemedText>
                            {summary ? (
                                <DueTargetIndicator
                                    count={summary.dueTargetCount}
                                />
                            ) : null}
                        </View>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {isLoading
                                ? "Loading detail"
                                : summary
                                  ? [
                                        formatCount(
                                            summary.targetCount,
                                            "target"
                                        ),
                                        formatCount(
                                            summary.practiceItemCount,
                                            "practice item"
                                        ),
                                        summary.dueTargetCount > 0
                                            ? `${summary.dueTargetCount} due`
                                            : undefined,
                                    ]
                                        .filter(Boolean)
                                        .join(", ")
                                  : "No summary"}
                        </ThemedText>
                    </View>

                    <KnowledgeActionButton
                        label="Back"
                        onPress={() => router.back()}
                        variant="secondary"
                    />
                </View>

                {errorMessage ? (
                    <ThemedText selectable type="small" style={styles.error}>
                        {errorMessage}
                    </ThemedText>
                ) : null}

                {source ? (
                    <>
                        <KnowledgeDetailSection title="Original need">
                            <ThemedText selectable type="small">
                                {source.inquiry.userNeed}
                            </ThemedText>
                        </KnowledgeDetailSection>

                        <KnowledgeDetailSection title="Objective">
                            <ThemedText selectable type="small">
                                {source.knowledgePoint.objective}
                            </ThemedText>
                        </KnowledgeDetailSection>

                        <KnowledgeDetailSection title="Context">
                            <ThemedView
                                type="backgroundElement"
                                style={styles.codeBlock}
                            >
                                <ThemedText selectable type="code">
                                    {formatContext(
                                        source.knowledgePoint.contextSnapshot
                                    )}
                                </ThemedText>
                            </ThemedView>
                        </KnowledgeDetailSection>

                        <KnowledgeDetailSection title="Recommended utterance">
                            {source.utterance ? (
                                <ThemedView
                                    type="backgroundElement"
                                    style={styles.inlinePanel}
                                >
                                    <ThemedText selectable type="smallBold">
                                        {source.utterance.text}
                                    </ThemedText>
                                    {source.utterance.usageNote ? (
                                        <ThemedText
                                            selectable
                                            type="small"
                                            themeColor="textSecondary"
                                        >
                                            {source.utterance.usageNote}
                                        </ThemedText>
                                    ) : null}
                                </ThemedView>
                            ) : (
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    No recommended utterance.
                                </ThemedText>
                            )}
                        </KnowledgeDetailSection>

                        <KnowledgeDetailSection title="Expressions">
                            {source.expressions.length > 0 ? (
                                <View style={styles.expressionList}>
                                    {source.expressions.map(
                                        ({ expression, link }) => (
                                            <ThemedView
                                                key={`${expression.id}:${link.role}`}
                                                type="backgroundElement"
                                                style={styles.expressionRow}
                                            >
                                                <View
                                                    style={
                                                        styles.expressionText
                                                    }
                                                >
                                                    <ThemedText
                                                        selectable
                                                        type="smallBold"
                                                    >
                                                        {expression.text}
                                                    </ThemedText>
                                                    <ThemedText
                                                        selectable
                                                        type="small"
                                                        themeColor="textSecondary"
                                                    >
                                                        {expression.meaningNote ??
                                                            expression.usageNote ??
                                                            expression.normalizedText}
                                                    </ThemedText>
                                                </View>
                                                <ThemedText
                                                    selectable
                                                    type="code"
                                                    themeColor="textSecondary"
                                                    style={styles.roleText}
                                                >
                                                    {link.role}
                                                </ThemedText>
                                            </ThemedView>
                                        )
                                    )}
                                </View>
                            ) : (
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    No expressions linked.
                                </ThemedText>
                            )}
                        </KnowledgeDetailSection>

                        <View style={styles.actionPanel}>
                            <View style={styles.actionRow}>
                                <KnowledgeActionButton
                                    label="Generate targets"
                                    loading={actionState === "targets"}
                                    disabled={actionState !== "idle"}
                                    onPress={handleGenerateTargets}
                                />
                                <KnowledgeActionButton
                                    label="Generate practice data"
                                    loading={actionState === "practice"}
                                    disabled={actionState !== "idle"}
                                    onPress={handleGeneratePractice}
                                    variant="secondary"
                                />
                            </View>

                            {resultMessage ? (
                                <ThemedText selectable type="small">
                                    {resultMessage}
                                </ThemedText>
                            ) : null}
                        </View>
                    </>
                ) : null}
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
        gap: Spacing.four,
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
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.two,
    },
    titleText: {
        flex: 1,
    },
    codeBlock: {
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    inlinePanel: {
        gap: Spacing.one,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    expressionList: {
        gap: Spacing.two,
    },
    expressionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    expressionText: {
        flex: 1,
        gap: Spacing.one,
    },
    roleText: {
        textTransform: "uppercase",
    },
    actionPanel: {
        gap: Spacing.two,
        paddingTop: Spacing.three,
        borderTopWidth: 1,
        borderTopColor: "rgba(130, 130, 145, 0.18)",
    },
    actionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    error: {
        color: "#c2410c",
    },
});
