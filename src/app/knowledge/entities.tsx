import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KnowledgeActionButton } from "@/components/knowledge/knowledge-action-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { showAlert, showConfirm } from "@/components/ui/platform-alert";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import {
    type KnowledgeEntityRef,
    type KnowledgeEntitySummary,
    useRepositories,
} from "@/data/repositories";
import { useTheme } from "@/hooks/use-theme";
import { usePracticeReminderState } from "@/providers/practice-reminder-state";

function formatCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getEntityTitle(summary: KnowledgeEntitySummary) {
    if (summary.entityType === "concept") {
        return summary.entity.canonicalLabel;
    }

    if (summary.entityType === "expression") {
        return summary.entity.text;
    }

    return summary.entity.template;
}

function getEntityDescription(summary: KnowledgeEntitySummary) {
    if (summary.entityType === "concept") {
        return (
            summary.entity.definition ??
            summary.entity.disambiguationNote ??
            "No concept note."
        );
    }

    if (summary.entityType === "expression") {
        return (
            summary.entity.meaningNote ??
            summary.entity.usageNote ??
            summary.entity.normalizedText
        );
    }

    return (
        summary.entity.explanation ??
        summary.entity.usageScope ??
        "No pattern note."
    );
}

function getEntityMeta(summary: KnowledgeEntitySummary) {
    const meta = [
        formatCount(summary.knowledgePointCount, "knowledge point"),
        formatCount(summary.learningTargetCount, "target"),
        formatCount(summary.relationCount, "relation"),
        `status ${summary.entity.status}`,
    ];

    if (summary.entityType !== "concept") {
        meta.push(`language ${summary.entity.language}`);
    } else if (summary.entity.languageHint) {
        meta.push(`language ${summary.entity.languageHint}`);
    }

    return meta.join(", ");
}

function getEntityRef(summary: KnowledgeEntitySummary): KnowledgeEntityRef {
    return {
        entityType: summary.entityType,
        entityId: summary.entity.id,
    };
}

function getEntityKey(summary: KnowledgeEntitySummary) {
    const ref = getEntityRef(summary);

    return `${ref.entityType}:${ref.entityId}`;
}

export default function KnowledgeEntitiesScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { refreshDueTargets } = usePracticeReminderState();
    const { knowledge } = useRepositories();
    const [entities, setEntities] = useState<KnowledgeEntitySummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingKey, setDeletingKey] = useState<string>();
    const [resultMessage, setResultMessage] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string>();

    const loadEntities = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(undefined);

        try {
            setEntities(await knowledge.listKnowledgeEntities());
        } catch (error) {
            console.error("Failed to load knowledge entities", error);
            setErrorMessage("Knowledge entities could not be loaded.");
        } finally {
            setIsLoading(false);
        }
    }, [knowledge]);

    useEffect(() => {
        let isMounted = true;

        async function loadInitialEntities() {
            try {
                const nextEntities = await knowledge.listKnowledgeEntities();

                if (isMounted) {
                    setEntities(nextEntities);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load knowledge entities", error);

                if (isMounted) {
                    setErrorMessage("Knowledge entities could not be loaded.");
                    setIsLoading(false);
                }
            }
        }

        loadInitialEntities();

        return () => {
            isMounted = false;
        };
    }, [knowledge]);

    const handleDeleteEntity = useCallback(
        async (summary: KnowledgeEntitySummary) => {
            const ref = getEntityRef(summary);
            const key = getEntityKey(summary);
            const title = getEntityTitle(summary);
            const confirmed = await showConfirm({
                title: "Delete knowledge entity?",
                message: `This removes "${title}" from knowledge points, relations, and any learning targets that only used this entity.`,
                confirmText: "Delete",
                destructive: true,
            });

            if (!confirmed) {
                return;
            }

            setDeletingKey(key);
            setResultMessage(undefined);
            setErrorMessage(undefined);

            try {
                const result = await knowledge.deleteKnowledgeEntity(ref);

                if (!result.deletedEntity) {
                    setErrorMessage("Knowledge entity could not be found.");
                    return;
                }

                setEntities((current) =>
                    current.filter((entity) => getEntityKey(entity) !== key)
                );
                setResultMessage(
                    [
                        `Deleted ${summary.entityType}.`,
                        `${formatCount(
                            result.unlinkedKnowledgePointCount,
                            "knowledge point"
                        )} unlinked.`,
                        `${formatCount(
                            result.deletedLearningTargetCount,
                            "target"
                        )} deleted.`,
                        `${formatCount(
                            result.deletedPracticeItemCount,
                            "practice item"
                        )} deleted.`,
                    ].join(" ")
                );
                await refreshDueTargets();
            } catch (error) {
                console.error("Failed to delete knowledge entity", error);
                setErrorMessage("Knowledge entity could not be deleted.");
                showAlert(
                    "Delete failed",
                    "The knowledge entity could not be deleted."
                );
            } finally {
                setDeletingKey(undefined);
            }
        },
        [knowledge, refreshDueTargets]
    );

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
                            Knowledge entities
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {isLoading
                                ? "Loading entities"
                                : `${entities.length} entities`}
                        </ThemedText>
                    </View>

                    <View style={styles.headerActions}>
                        <KnowledgeActionButton
                            label="Back"
                            onPress={() => router.back()}
                            variant="secondary"
                        />
                        <KnowledgeActionButton
                            label="Refresh"
                            loading={isLoading}
                            onPress={loadEntities}
                            variant="secondary"
                        />
                    </View>
                </View>

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
                    {entities.map((summary) => {
                        const key = getEntityKey(summary);

                        return (
                            <ThemedView
                                key={key}
                                type="backgroundElement"
                                style={styles.entityCard}
                            >
                                <View style={styles.entityHeader}>
                                    <View style={styles.entityText}>
                                        <ThemedText selectable type="smallBold">
                                            {getEntityTitle(summary)}
                                        </ThemedText>
                                        <ThemedText
                                            selectable
                                            type="small"
                                            themeColor="textSecondary"
                                        >
                                            {getEntityDescription(summary)}
                                        </ThemedText>
                                    </View>
                                    <ThemedText
                                        selectable
                                        type="code"
                                        themeColor="textSecondary"
                                        style={styles.typeText}
                                    >
                                        {summary.entityType}
                                    </ThemedText>
                                </View>

                                <View style={styles.entityFooter}>
                                    <ThemedText
                                        selectable
                                        type="small"
                                        themeColor="textSecondary"
                                        style={styles.metaText}
                                    >
                                        {getEntityMeta(summary)}
                                    </ThemedText>
                                    <KnowledgeActionButton
                                        label="Delete"
                                        loading={deletingKey === key}
                                        disabled={Boolean(deletingKey)}
                                        onPress={() =>
                                            handleDeleteEntity(summary)
                                        }
                                        variant="danger"
                                    />
                                </View>
                            </ThemedView>
                        );
                    })}

                    {!isLoading && entities.length === 0 ? (
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            No knowledge entities yet.
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
    entityCard: {
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    entityHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    entityText: {
        flex: 1,
        gap: Spacing.one,
    },
    typeText: {
        textTransform: "uppercase",
    },
    entityFooter: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.two,
    },
    metaText: {
        flex: 1,
        fontVariant: ["tabular-nums"],
    },
    error: {
        color: "#c2410c",
    },
});
