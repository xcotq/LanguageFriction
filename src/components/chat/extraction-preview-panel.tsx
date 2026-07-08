import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { SessionExtractionPreview } from "@/services/session-extraction";

function decisionLabel(decision: string) {
    if (decision === "create_new") {
        return "Create";
    }

    if (decision === "link_existing") {
        return "Link";
    }

    return "Ignore";
}

function previewCountLabel(count: number) {
    return count === 1 ? "1 pending inquiry" : `${count} pending inquiries`;
}

export function ExtractionPreviewPanel({
    preview,
    isConfirming,
    onCancel,
    onConfirm,
}: {
    preview: SessionExtractionPreview;
    isConfirming: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const canConfirm = preview.inquiryPreviews.length > 0 && !isConfirming;

    return (
        <ThemedView type="backgroundElement" style={styles.panel}>
            <View style={styles.header}>
                <ThemedText selectable type="smallBold">
                    {previewCountLabel(preview.inquiryPreviews.length)}
                </ThemedText>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {new Date(preview.generatedAt).toLocaleTimeString()}
                </ThemedText>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
            >
                {preview.inquiryPreviews.length === 0 ? (
                    <ThemedText selectable type="small">
                        No knowledge candidate was extracted.
                    </ThemedText>
                ) : (
                    preview.inquiryPreviews.map((item) => (
                        <View key={item.tempId} style={styles.item}>
                            <ThemedText selectable type="smallBold">
                                {item.inquiry.title}
                            </ThemedText>
                            <ThemedText
                                selectable
                                type="small"
                                themeColor="textSecondary"
                            >
                                {item.inquiry.userNeed}
                            </ThemedText>
                            <ThemedText selectable type="small">
                                {item.inquiry.primaryLanguageContext}
                            </ThemedText>
                            <ThemedText selectable type="small">
                                {item.knowledgePoint.objective}
                            </ThemedText>

                            {item.utterances.map((utterance) => (
                                <ThemedText
                                    selectable
                                    key={`${item.tempId}-${utterance.role}-${utterance.text}`}
                                    type="code"
                                >
                                    {utterance.role}: {utterance.text}
                                </ThemedText>
                            ))}

                            {item.entities.slice(0, 6).map((entity) => (
                                <ThemedText
                                    selectable
                                    key={`${item.tempId}-${entity.tempRef}`}
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    {decisionLabel(entity.decision)}{" "}
                                    {entity.entityType}: {entity.displayLabel}
                                </ThemedText>
                            ))}

                            {item.relations.length > 0 ? (
                                <ThemedText
                                    selectable
                                    type="small"
                                    themeColor="textSecondary"
                                >
                                    {item.relations.length} relation
                                    {item.relations.length === 1 ? "" : "s"}
                                </ThemedText>
                            ) : null}
                        </View>
                    ))
                )}
            </ScrollView>

            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel knowledge preview"
                    onPress={onCancel}
                    disabled={isConfirming}
                    style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                        isConfirming && styles.disabled,
                    ]}
                >
                    <ThemedText
                        type="smallBold"
                        style={styles.secondaryButtonText}
                    >
                        Cancel
                    </ThemedText>
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirm knowledge preview"
                    onPress={onConfirm}
                    disabled={!canConfirm}
                    style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.pressed,
                        !canConfirm && styles.disabled,
                    ]}
                >
                    <ThemedText
                        type="smallBold"
                        style={styles.primaryButtonText}
                    >
                        {isConfirming ? "Confirming..." : "Confirm"}
                    </ThemedText>
                </Pressable>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    panel: {
        maxHeight: 336,
        gap: Spacing.two,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.22)",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.two,
    },
    scroll: {
        maxHeight: 220,
    },
    scrollContent: {
        gap: Spacing.two,
    },
    item: {
        gap: Spacing.one,
        paddingTop: Spacing.two,
        borderTopWidth: 1,
        borderTopColor: "rgba(130, 130, 145, 0.22)",
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: Spacing.two,
    },
    secondaryButton: {
        minHeight: 40,
        minWidth: 86,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.32)",
        paddingHorizontal: Spacing.three,
    },
    secondaryButtonText: {
        color: "#60646c",
    },
    primaryButton: {
        minHeight: 40,
        minWidth: 96,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
        boxShadow: "0 2px 6px rgba(47, 111, 237, 0.22)",
    },
    primaryButtonText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.72,
    },
    disabled: {
        opacity: 0.45,
    },
});
