import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KnowledgeActionButton } from "@/components/knowledge/knowledge-action-button";
import {
    formatDate,
    formatDateTime,
    formatEvidenceResult,
    formatLearningAbility,
    formatLearningTargetStatus,
    formatPracticeItemType,
    formatPracticePromptSummary,
    formatPracticeValue,
} from "@/components/practice/practice-format";
import { PracticePromptDisplay } from "@/components/practice/practice-prompt-display";
import { PracticeValueBlock } from "@/components/practice/practice-value-block";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import {
    useRepositories,
    type PracticeItemDetail,
    type PracticeItemResponseDetail,
    type PracticeItemTargetDetail,
} from "@/data/repositories";
import { useTheme } from "@/hooks/use-theme";
import type { LearningTarget } from "@/types/domain";

const CURRENT_USER_ID = "mock-user";

function formatCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

function TargetPanel({ detail }: { detail: PracticeItemTargetDetail }) {
    const due = isDueTarget(detail.target);

    return (
        <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.panelHeader}>
                <View style={styles.panelTitle}>
                    <ThemedText selectable type="smallBold">
                        {formatLearningAbility(detail.target.ability)}
                    </ThemedText>
                    <ThemedText
                        selectable
                        type="small"
                        themeColor="textSecondary"
                    >
                        {formatLearningTargetStatus(detail.target.status)}
                    </ThemedText>
                </View>
                <ThemedText
                    selectable
                    type="small"
                    style={due ? styles.dueText : styles.metaText}
                    themeColor={due ? undefined : "textSecondary"}
                >
                    {formatDueLabel(detail.target)}
                </ThemedText>
            </View>

            <View style={styles.metaRow}>
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    Weight {detail.link.weight}
                </ThemedText>
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    Priority {detail.target.priority}
                </ThemedText>
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    {formatCount(detail.target.reviewCount, "review")}
                </ThemedText>
            </View>

            <View style={styles.entityList}>
                {detail.entities.map((entity) => (
                    <ThemedView
                        key={`${entity.entityType}:${entity.entityId}:${entity.role}`}
                        type="backgroundSelected"
                        style={styles.entityBadge}
                    >
                        <ThemedText selectable type="code">
                            {entity.role} {entity.entityType}
                        </ThemedText>
                    </ThemedView>
                ))}
            </View>
        </ThemedView>
    );
}

function ResponsePanel({ detail }: { detail: PracticeItemResponseDetail }) {
    return (
        <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.panelHeader}>
                <ThemedText selectable type="smallBold">
                    {formatDateTime(detail.response.submittedAt)}
                </ThemedText>
                <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                    style={styles.metaText}
                >
                    {formatCount(detail.evidence.length, "evidence")}
                </ThemedText>
            </View>

            <ThemedText selectable type="small">
                {formatPracticeValue(detail.response.answer, {
                    preferText: true,
                })}
            </ThemedText>

            {detail.feedback ? (
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {formatPracticeValue(detail.feedback.feedback, {
                        preferText: true,
                    })}
                </ThemedText>
            ) : null}

            {detail.evidence.length > 0 ? (
                <View style={styles.evidenceList}>
                    {detail.evidence.map((evidence) => (
                        <ThemedView
                            key={evidence.id}
                            type="backgroundSelected"
                            style={styles.evidenceBadge}
                        >
                            <ThemedText selectable type="smallBold">
                                {formatEvidenceResult(evidence.result)}
                            </ThemedText>
                            {typeof evidence.confidence === "number" ? (
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    {Math.round(evidence.confidence * 100)}%
                                </ThemedText>
                            ) : null}
                        </ThemedView>
                    ))}
                </View>
            ) : null}
        </ThemedView>
    );
}

export default function PracticeItemDetailScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ practiceItemId?: string }>();
    const practiceItemId =
        typeof params.practiceItemId === "string"
            ? params.practiceItemId
            : undefined;
    const { practice, practiceResponseEvaluation } = useRepositories();
    const [detail, setDetail] = useState<PracticeItemDetail | null>(null);
    const [answerText, setAnswerText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [answerRevealedBeforeSubmit, setAnswerRevealedBeforeSubmit] =
        useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const hasResponses = (detail?.responses.length ?? 0) > 0;
    const canSubmitAnswer =
        Boolean(detail) && answerText.trim().length > 0 && !isSubmitting;

    const fetchPracticeItem = useCallback(async () => {
        if (!practiceItemId) {
            return {
                detail: null,
                errorMessage: "Missing practice item id.",
            };
        }

        const nextDetail = await practice.getPracticeItemDetail(
            CURRENT_USER_ID,
            practiceItemId
        );

        return {
            detail: nextDetail,
            errorMessage: nextDetail ? undefined : "Practice item not found.",
        };
    }, [practice, practiceItemId]);

    const loadPracticeItem = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(undefined);

        try {
            const next = await fetchPracticeItem();

            setDetail(next.detail);
            setErrorMessage(next.errorMessage);
        } catch (error) {
            console.error("Failed to load practice item", error);
            setErrorMessage("Practice item could not be loaded.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchPracticeItem]);

    const handleSubmitAnswer = useCallback(async () => {
        const trimmedAnswer = answerText.trim();

        if (!detail || !trimmedAnswer) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(undefined);

        try {
            await practiceResponseEvaluation.evaluate({
                userId: CURRENT_USER_ID,
                practiceItemId: detail.item.id,
                answer: {
                    text: trimmedAnswer,
                    interaction: {
                        revealedAnswerBeforeSubmit: answerRevealedBeforeSubmit,
                    },
                },
            });
            setAnswerText("");
            setAnswerRevealedBeforeSubmit(false);
            setShowAnswer(true);
            await loadPracticeItem();
        } catch (error) {
            console.error("Failed to submit practice answer", error);
            setErrorMessage("Your answer could not be saved.");
        } finally {
            setIsSubmitting(false);
        }
    }, [
        answerRevealedBeforeSubmit,
        answerText,
        detail,
        loadPracticeItem,
        practiceResponseEvaluation,
    ]);

    const handleToggleAnswer = useCallback(() => {
        setShowAnswer((previousValue) => {
            const nextValue = !previousValue;

            if (nextValue && !hasResponses) {
                setAnswerRevealedBeforeSubmit(true);
            }

            return nextValue;
        });
    }, [hasResponses]);

    useEffect(() => {
        let isMounted = true;

        async function loadInitialPracticeItem() {
            try {
                const next = await fetchPracticeItem();

                if (isMounted) {
                    setDetail(next.detail);
                    setErrorMessage(next.errorMessage);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load practice item", error);

                if (isMounted) {
                    setErrorMessage("Practice item could not be loaded.");
                    setIsLoading(false);
                }
            }
        }

        loadInitialPracticeItem();

        return () => {
            isMounted = false;
        };
    }, [fetchPracticeItem]);

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
                        <ThemedText
                            selectable
                            type="subtitle"
                            style={styles.title}
                        >
                            Practice item
                        </ThemedText>
                        {detail ? (
                            <ThemedText selectable type="smallBold">
                                {formatPracticePromptSummary(
                                    detail.item.prompt
                                )}
                            </ThemedText>
                        ) : null}
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {isLoading
                                ? "Loading detail"
                                : detail
                                  ? [
                                        formatPracticeItemType(
                                            detail.item.type
                                        ),
                                        formatCount(
                                            detail.targetCount,
                                            "target"
                                        ),
                                        detail.dueTargetCount > 0
                                            ? `${detail.dueTargetCount} due`
                                            : undefined,
                                        formatCount(
                                            detail.responseCount,
                                            "answer"
                                        ),
                                    ]
                                        .filter(Boolean)
                                        .join(", ")
                                  : "No detail"}
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

                {detail ? (
                    <>
                        <PracticePromptDisplay prompt={detail.item.prompt} />

                        {!hasResponses ? (
                            <View style={styles.section}>
                                <ThemedText selectable type="smallBold">
                                    Your answer
                                </ThemedText>
                                <TextInput
                                    multiline
                                    value={answerText}
                                    onChangeText={setAnswerText}
                                    editable={!isSubmitting}
                                    placeholder="Type your answer here"
                                    placeholderTextColor={theme.textSecondary}
                                    style={[
                                        styles.answerInput,
                                        {
                                            color: theme.text,
                                            backgroundColor:
                                                theme.backgroundElement,
                                        },
                                    ]}
                                    textAlignVertical="top"
                                />
                                <View style={styles.actionRow}>
                                    <KnowledgeActionButton
                                        label="Submit answer"
                                        loading={isSubmitting}
                                        disabled={!canSubmitAnswer}
                                        onPress={handleSubmitAnswer}
                                    />
                                </View>
                            </View>
                        ) : (
                            <ThemedView
                                type="backgroundElement"
                                style={styles.answeredPanel}
                            >
                                <ThemedText selectable type="smallBold">
                                    Answered
                                </ThemedText>
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    This practice item has a saved response.
                                </ThemedText>
                            </ThemedView>
                        )}

                        <View style={styles.actionRow}>
                            <KnowledgeActionButton
                                label={
                                    showAnswer ? "Hide answer" : "Show answer"
                                }
                                onPress={handleToggleAnswer}
                                variant={showAnswer ? "secondary" : "primary"}
                            />
                            <KnowledgeActionButton
                                label="Refresh"
                                loading={isLoading}
                                onPress={loadPracticeItem}
                                variant="secondary"
                            />
                        </View>

                        {showAnswer ? (
                            <>
                                <PracticeValueBlock
                                    title="Expected answer"
                                    value={detail.item.expectedAnswer}
                                    preferText
                                />
                                <PracticeValueBlock
                                    title="Acceptable answers"
                                    value={detail.item.acceptableAnswers}
                                    emptyText="No alternatives recorded."
                                />
                            </>
                        ) : null}

                        <View style={styles.section}>
                            <ThemedText selectable type="smallBold">
                                Targets
                            </ThemedText>
                            <View style={styles.sectionContent}>
                                {detail.targets.map((targetDetail) => (
                                    <TargetPanel
                                        key={`${targetDetail.link.practiceItemId}:${targetDetail.link.learningTargetId}`}
                                        detail={targetDetail}
                                    />
                                ))}
                            </View>
                        </View>

                        <PracticeValueBlock
                            title="Prompt payload"
                            value={detail.item.prompt}
                        />

                        <PracticeValueBlock
                            title="Context snapshot"
                            value={detail.item.contextSnapshot}
                            emptyText="No context snapshot."
                        />

                        <View style={styles.section}>
                            <ThemedText selectable type="smallBold">
                                Response history
                            </ThemedText>
                            <View style={styles.sectionContent}>
                                {detail.responses.map((responseDetail) => (
                                    <ResponsePanel
                                        key={responseDetail.response.id}
                                        detail={responseDetail}
                                    />
                                ))}

                                {detail.responses.length === 0 ? (
                                    <ThemedText
                                        selectable
                                        type="small"
                                        themeColor="textSecondary"
                                    >
                                        No responses yet.
                                    </ThemedText>
                                ) : null}
                            </View>
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
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    headerText: {
        flex: 1,
        gap: Spacing.one,
    },
    title: {
        flexShrink: 1,
    },
    section: {
        gap: Spacing.two,
    },
    sectionContent: {
        gap: Spacing.two,
    },
    actionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    answerInput: {
        minHeight: 132,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.28)",
        padding: Spacing.three,
        fontSize: 16,
        lineHeight: 24,
    },
    answeredPanel: {
        gap: Spacing.one,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    panel: {
        gap: Spacing.two,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    panelHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    panelTitle: {
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
        fontVariant: ["tabular-nums"],
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
    evidenceList: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.two,
    },
    evidenceBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.one,
        borderRadius: 8,
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.two,
    },
    error: {
        color: "#c2410c",
    },
});
