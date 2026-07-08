import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KnowledgeActionButton } from "@/components/knowledge/knowledge-action-button";
import {
    formatDate,
    formatDateTime,
    formatLearningAbility,
    formatLearningTargetStatus,
} from "@/components/practice/practice-format";
import { PracticeSummaryCard } from "@/components/practice/practice-summary-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { showAlert, showConfirm } from "@/components/ui/platform-alert";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import {
    useRepositories,
    type LearningTargetSummary,
    type PracticeItemSummary,
} from "@/data/repositories";
import { useTheme } from "@/hooks/use-theme";
import { usePracticeReminderState } from "@/providers/practice-reminder-state";
import type { LearningTarget } from "@/types/domain";

const CURRENT_USER_ID = "mock-user";

type PracticeViewMode = "items" | "targets";

type TargetActionState =
    | {
          kind: "generate" | "delete";
          targetId: string;
      }
    | undefined;

function pluralize(count: number, singular: string) {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function isDueTarget(target: LearningTarget) {
    return (
        target.status === "active" &&
        (!target.dueAt || target.dueAt <= new Date())
    );
}

function formatDueLabel(target: LearningTarget) {
    if (target.status !== "active") {
        return formatLearningTargetStatus(target.status);
    }

    if (!target.dueAt) {
        return "Due now";
    }

    return `Due ${formatDate(target.dueAt)}`;
}

function formatTargetEntityLabel(entity: LearningTargetSummary["entities"][0]) {
    const idParts = entity.entityId.split(":");
    const compactId = idParts[idParts.length - 1] ?? entity.entityId;

    return `${entity.role} ${entity.entityType}: ${compactId}`;
}

function canGeneratePracticeForTarget(target: LearningTarget) {
    return (
        target.status === "active" &&
        (target.ability === "recognition" ||
            target.ability === "recall" ||
            target.ability === "contextual_production" ||
            target.ability === "distinction")
    );
}

function PracticeViewToggle({
    itemCount,
    targetCount,
    value,
    onChange,
}: {
    itemCount: number;
    targetCount: number;
    value: PracticeViewMode;
    onChange: (value: PracticeViewMode) => void;
}) {
    return (
        <ThemedView type="backgroundElement" style={styles.toggle}>
            {(
                [
                    ["items", `Items ${itemCount}`],
                    ["targets", `Targets ${targetCount}`],
                ] as const
            ).map(([mode, label]) => {
                const selected = value === mode;

                return (
                    <Pressable
                        key={mode}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => onChange(mode)}
                        style={({ pressed }) => [
                            styles.toggleButton,
                            selected && styles.toggleButtonSelected,
                            pressed && styles.pressed,
                        ]}
                    >
                        <ThemedText
                            selectable
                            type="smallBold"
                            themeColor={selected ? "text" : "textSecondary"}
                            style={styles.toggleText}
                        >
                            {label}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </ThemedView>
    );
}

function LearningTargetCard({
    summary,
    actionState,
    onDelete,
    onGeneratePractice,
}: {
    summary: LearningTargetSummary;
    actionState: TargetActionState;
    onDelete: (targetId: string) => void;
    onGeneratePractice: (targetId: string) => void;
}) {
    const { target } = summary;
    const due = isDueTarget(target);
    const canGenerate = canGeneratePracticeForTarget(target);
    const isGenerating =
        actionState?.kind === "generate" && actionState.targetId === target.id;
    const isDeleting =
        actionState?.kind === "delete" && actionState.targetId === target.id;
    const hasAction = Boolean(actionState);

    return (
        <ThemedView type="backgroundElement" style={styles.targetCard}>
            <View style={styles.targetHeader}>
                <View style={styles.targetTitleColumn}>
                    <ThemedText selectable type="smallBold">
                        {summary.knowledgePointTitle ?? "Unanchored target"}
                    </ThemedText>
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        {formatLearningAbility(target.ability)}
                    </ThemedText>
                </View>

                <ThemedText
                    selectable
                    type="small"
                    themeColor={due ? undefined : "textSecondary"}
                    style={[styles.metaText, due && styles.dueText]}
                >
                    {formatDueLabel(target)}
                </ThemedText>
            </View>

            {summary.knowledgePointObjective ? (
                <ThemedText selectable type="small">
                    {summary.knowledgePointObjective}
                </ThemedText>
            ) : null}

            <View style={styles.metaRow}>
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    Priority {target.priority}
                </ThemedText>
                {target.difficulty ? (
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        {target.difficulty}
                    </ThemedText>
                ) : null}
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    {pluralize(target.reviewCount, "review")}
                </ThemedText>
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    {pluralize(summary.practiceItemCount, "practice item")}
                </ThemedText>
                {summary.latestPracticeGeneratedAt ? (
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                        style={styles.metaText}
                    >
                        Latest{" "}
                        {formatDateTime(summary.latestPracticeGeneratedAt)}
                    </ThemedText>
                ) : null}
            </View>

            {summary.entities.length > 0 ? (
                <View style={styles.entityList}>
                    {summary.entities.map((entity) => (
                        <ThemedView
                            key={`${entity.learningTargetId}:${entity.entityType}:${entity.entityId}:${entity.role}`}
                            type="backgroundSelected"
                            style={styles.entityBadge}
                        >
                            <ThemedText selectable type="code">
                                {formatTargetEntityLabel(entity)}
                            </ThemedText>
                        </ThemedView>
                    ))}
                </View>
            ) : null}

            <View style={styles.actionRow}>
                <KnowledgeActionButton
                    label="Generate item"
                    loading={isGenerating}
                    disabled={hasAction || !canGenerate}
                    onPress={() => onGeneratePractice(target.id)}
                />
                <KnowledgeActionButton
                    label="Delete target"
                    loading={isDeleting}
                    disabled={hasAction}
                    onPress={() => onDelete(target.id)}
                    variant="danger"
                />
            </View>
        </ThemedView>
    );
}

export default function PracticeScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { refreshDueTargets } = usePracticeReminderState();
    const { practice, practiceItemGeneration } = useRepositories();
    const [viewMode, setViewMode] = useState<PracticeViewMode>("items");
    const [practiceSummaries, setPracticeSummaries] = useState<
        PracticeItemSummary[]
    >([]);
    const [targetSummaries, setTargetSummaries] = useState<
        LearningTargetSummary[]
    >([]);
    const [isLoading, setIsLoading] = useState(true);
    const [targetActionState, setTargetActionState] =
        useState<TargetActionState>();
    const [resultMessage, setResultMessage] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string>();
    const duePracticeCount = practiceSummaries.filter(
        (summary) => summary.dueTargetCount > 0
    ).length;
    const answeredPracticeCount = practiceSummaries.filter(
        (summary) => summary.responseCount > 0
    ).length;
    const dueTargetCount = targetSummaries.filter(({ target }) =>
        isDueTarget(target)
    ).length;
    const activeTargetCount = targetSummaries.filter(
        ({ target }) => target.status === "active"
    ).length;

    const fetchPracticeData = useCallback(async () => {
        const [items, targets] = await Promise.all([
            practice.listPracticeItemSummaries(CURRENT_USER_ID),
            practice.listLearningTargetSummaries(CURRENT_USER_ID),
        ]);

        return { items, targets };
    }, [practice]);

    const loadPracticeData = useCallback(async () => {
        setIsLoading(true);
        setResultMessage(undefined);
        setErrorMessage(undefined);

        try {
            const next = await fetchPracticeData();

            setPracticeSummaries(next.items);
            setTargetSummaries(next.targets);
        } catch (error) {
            console.error("Failed to load practice data", error);
            setErrorMessage("Practice data could not be loaded.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchPracticeData]);

    const handleGeneratePracticeItem = useCallback(
        async (learningTargetId: string) => {
            setTargetActionState({
                kind: "generate",
                targetId: learningTargetId,
            });
            setResultMessage(undefined);
            setErrorMessage(undefined);

            try {
                const draft =
                    await practiceItemGeneration.generateForLearningTarget({
                        userId: CURRENT_USER_ID,
                        learningTargetId,
                        allowEarlyPractice: true,
                    });

                await loadPracticeData();
                await refreshDueTargets();
                setResultMessage(
                    draft
                        ? "1 practice item generated"
                        : "No practice item could be generated for this target."
                );
                setViewMode("items");
            } catch (error) {
                console.error("Failed to generate practice item", error);
                setErrorMessage("Practice item could not be generated.");
            } finally {
                setTargetActionState(undefined);
            }
        },
        [loadPracticeData, practiceItemGeneration, refreshDueTargets]
    );

    const handleDeleteTarget = useCallback(
        async (learningTargetId: string) => {
            const confirmed = await showConfirm({
                title: "Delete target?",
                message:
                    "This removes the target and any practice item that no longer trains another target.",
                confirmText: "Delete",
                destructive: true,
            });

            if (!confirmed) {
                return;
            }

            setTargetActionState({
                kind: "delete",
                targetId: learningTargetId,
            });
            setResultMessage(undefined);
            setErrorMessage(undefined);

            try {
                const result = await practice.deleteLearningTarget({
                    userId: CURRENT_USER_ID,
                    learningTargetId,
                });

                if (!result.deletedLearningTarget) {
                    setErrorMessage("Target could not be found.");
                    return;
                }

                await loadPracticeData();
                await refreshDueTargets();
                setResultMessage(
                    result.deletedPracticeItemCount > 0
                        ? `Target deleted. ${pluralize(
                              result.deletedPracticeItemCount,
                              "orphaned practice item"
                          )} removed.`
                        : "Target deleted."
                );
            } catch (error) {
                console.error("Failed to delete learning target", error);
                setErrorMessage("Target could not be deleted.");
                showAlert("Delete failed", "Target could not be deleted.");
            } finally {
                setTargetActionState(undefined);
            }
        },
        [loadPracticeData, practice, refreshDueTargets]
    );

    useEffect(() => {
        let isMounted = true;

        async function loadInitialPracticeData() {
            try {
                const next = await fetchPracticeData();

                if (isMounted) {
                    setPracticeSummaries(next.items);
                    setTargetSummaries(next.targets);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load practice data", error);

                if (isMounted) {
                    setErrorMessage("Practice data could not be loaded.");
                    setIsLoading(false);
                }
            }
        }

        loadInitialPracticeData();

        return () => {
            isMounted = false;
        };
    }, [fetchPracticeData]);

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
                                ? "Loading practice data"
                                : [
                                      pluralize(
                                          practiceSummaries.length,
                                          "practice item"
                                      ),
                                      pluralize(
                                          targetSummaries.length,
                                          "target"
                                      ),
                                      duePracticeCount > 0
                                          ? `${duePracticeCount} due`
                                          : undefined,
                                      dueTargetCount > 0
                                          ? `${dueTargetCount} due targets`
                                          : undefined,
                                      activeTargetCount > 0
                                          ? `${activeTargetCount} active`
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
                        onPress={loadPracticeData}
                        variant="secondary"
                    />
                </View>

                <PracticeViewToggle
                    itemCount={practiceSummaries.length}
                    targetCount={targetSummaries.length}
                    value={viewMode}
                    onChange={setViewMode}
                />

                {errorMessage ? (
                    <ThemedText selectable type="small" style={styles.error}>
                        {errorMessage}
                    </ThemedText>
                ) : null}

                {resultMessage ? (
                    <ThemedText selectable type="small">
                        {resultMessage}
                    </ThemedText>
                ) : null}

                <View style={styles.list}>
                    {viewMode === "items" ? (
                        <>
                            {practiceSummaries.map((summary) => (
                                <PracticeSummaryCard
                                    key={summary.item.id}
                                    summary={summary}
                                />
                            ))}

                            {!isLoading && practiceSummaries.length === 0 ? (
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    No practice items yet. Generate practice
                                    data from a knowledge point or target first.
                                </ThemedText>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {targetSummaries.map((summary) => (
                                <LearningTargetCard
                                    key={summary.target.id}
                                    summary={summary}
                                    actionState={targetActionState}
                                    onDelete={handleDeleteTarget}
                                    onGeneratePractice={
                                        handleGeneratePracticeItem
                                    }
                                />
                            ))}

                            {!isLoading && targetSummaries.length === 0 ? (
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    No targets yet. Generate targets from a
                                    knowledge point first.
                                </ThemedText>
                            ) : null}
                        </>
                    )}
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
    toggle: {
        flexDirection: "row",
        gap: Spacing.one,
        padding: Spacing.one,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    toggleButton: {
        flex: 1,
        minHeight: 38,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        paddingHorizontal: Spacing.two,
    },
    toggleButtonSelected: {
        backgroundColor: "rgba(47, 111, 237, 0.14)",
    },
    toggleText: {
        textAlign: "center",
    },
    targetCard: {
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    targetHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    targetTitleColumn: {
        flex: 1,
        gap: Spacing.one,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    metaText: {
        fontVariant: ["tabular-nums"],
    },
    dueText: {
        color: "#dc2626",
    },
    entityList: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    entityBadge: {
        borderRadius: 8,
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.two,
    },
    actionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    pressed: {
        opacity: 0.72,
    },
    error: {
        color: "#c2410c",
    },
});
