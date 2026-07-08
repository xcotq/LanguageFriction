import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import type {
    ChatActionStatus,
    ChatOperationStatus,
    ChatSessionScreenStatus,
} from "@/hooks/index-chat-session-types";

function extractionPreviewButtonLabel(
    sessionStatus: ChatSessionScreenStatus,
    operationStatus: ChatOperationStatus
) {
    if (operationStatus === "generating_preview") {
        return "Generating...";
    }

    if (sessionStatus === "closed") {
        return "Closed";
    }

    if (sessionStatus === "archived") {
        return "Archived";
    }

    return "Preview";
}

export function ChatHeader({
    sessionExists,
    sessionStatus,
    operationStatus,
    sessionLabel,
    workflowLabel,
    generateExtractionPreviewActionStatus,
    createSessionActionStatus,
    onCreateSession,
    onGenerateExtractionPreview,
    onOpenHistory,
}: {
    sessionExists: boolean;
    sessionStatus: ChatSessionScreenStatus;
    operationStatus: ChatOperationStatus;
    sessionLabel: string;
    workflowLabel: string;
    generateExtractionPreviewActionStatus: ChatActionStatus;
    createSessionActionStatus: ChatActionStatus;
    onCreateSession: () => void;
    onGenerateExtractionPreview: () => void;
    onOpenHistory: () => void;
}) {
    const generateExtractionPreviewDisabled =
        generateExtractionPreviewActionStatus !== "enabled";
    const createSessionDisabled = createSessionActionStatus !== "enabled";

    return (
        <View style={styles.header}>
            <View style={styles.headerText}>
                <ThemedText selectable type="subtitle">
                    LanguageFriction
                </ThemedText>
                <ThemedText selectable type="small" themeColor="textSecondary">
                    {sessionLabel} / {workflowLabel}
                </ThemedText>
            </View>

            <View style={styles.headerActions}>
                {sessionExists ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Generate extraction preview"
                        onPress={onGenerateExtractionPreview}
                        disabled={generateExtractionPreviewDisabled}
                        style={({ pressed }) => [
                            styles.previewButton,
                            pressed && styles.pressed,
                            generateExtractionPreviewDisabled &&
                                styles.disabled,
                            sessionStatus !== "active" &&
                                styles.inactivePreviewButton,
                        ]}
                    >
                        <ThemedText
                            type="smallBold"
                            style={styles.previewButtonText}
                        >
                            {extractionPreviewButtonLabel(
                                sessionStatus,
                                operationStatus
                            )}
                        </ThemedText>
                    </Pressable>
                ) : null}

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create a new session"
                    onPress={onCreateSession}
                    disabled={createSessionDisabled}
                    style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                        createSessionDisabled && styles.disabled,
                    ]}
                >
                    <ThemedText
                        type="smallBold"
                        style={styles.secondaryButtonText}
                    >
                        New
                    </ThemedText>
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    onPress={onOpenHistory}
                    style={({ pressed }) => [
                        styles.historyButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <ThemedText
                        type="smallBold"
                        style={styles.historyButtonText}
                    >
                        History
                    </ThemedText>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
        width: 118,
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-end",
        gap: Spacing.two,
    },
    previewButton: {
        minHeight: 38,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(22, 128, 60, 0.32)",
        backgroundColor: "rgba(22, 128, 60, 0.1)",
        paddingHorizontal: Spacing.two,
    },
    previewButtonText: {
        color: "#16803c",
    },
    inactivePreviewButton: {
        borderColor: "rgba(130, 130, 145, 0.28)",
        backgroundColor: "rgba(130, 130, 145, 0.12)",
    },
    secondaryButton: {
        minHeight: 38,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(47, 111, 237, 0.32)",
        backgroundColor: "rgba(47, 111, 237, 0.1)",
        paddingHorizontal: Spacing.two,
    },
    secondaryButtonText: {
        color: "#2f6fed",
    },
    historyButton: {
        minHeight: 38,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#1f56c5",
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
        boxShadow: "0 2px 6px rgba(47, 111, 237, 0.22)",
    },
    historyButtonText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.72,
    },
    disabled: {
        opacity: 0.45,
    },
});
