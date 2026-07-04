import { useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { MessageBubble } from "@/components/chat/message-bubble";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import type {
    ChatActionStatus,
    ChatOperationStatus,
} from "@/hooks/index-chat-session-types";
import type { ChatMessage } from "@/types/domain";

export function ChatSessionArea({
    isLoading,
    messages,
    sessionExists,
    createSessionActionStatus,
    operationStatus,
    onCreateSession,
}: {
    isLoading: boolean;
    messages: ChatMessage[];
    sessionExists: boolean;
    createSessionActionStatus: ChatActionStatus;
    operationStatus: ChatOperationStatus;
    onCreateSession: () => void;
}) {
    const listRef = useRef<FlatList<ChatMessage>>(null);
    const createSessionDisabled = createSessionActionStatus !== "enabled";

    useEffect(() => {
        const timer = setTimeout(
            () => listRef.current?.scrollToEnd({ animated: true }),
            80
        );
        return () => clearTimeout(timer);
    }, [messages.length]);

    if (isLoading || sessionExists) {
        return (
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <MessageBubble message={item} />}
                contentContainerStyle={styles.messageList}
                style={styles.list}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <ThemedText type="small" themeColor="textSecondary">
                        {isLoading
                            ? "Loading conversation..."
                            : "No messages yet."}
                    </ThemedText>
                }
            />
        );
    }

    return (
        <View style={styles.emptySession}>
            <ThemedText selectable type="subtitle" style={styles.emptyTitle}>
                Start a new session
            </ThemedText>
            <ThemedText
                selectable
                type="small"
                themeColor="textSecondary"
                style={styles.emptyDescription}
            >
                Ask a small expression question and keep the useful wording in
                one place.
            </ThemedText>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a new session"
                onPress={onCreateSession}
                disabled={createSessionDisabled}
                style={({ pressed }) => [
                    styles.emptyPrimaryButton,
                    pressed && styles.pressed,
                    createSessionDisabled && styles.disabled,
                ]}
            >
                <ThemedText
                    type="smallBold"
                    style={styles.emptyPrimaryButtonText}
                >
                    {operationStatus === "creating"
                        ? "Creating..."
                        : "New session"}
                </ThemedText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
    },
    messageList: {
        gap: Spacing.three,
        paddingBottom: 96,
    },
    emptySession: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.two,
        paddingBottom: 96,
    },
    emptyTitle: {
        textAlign: "center",
    },
    emptyDescription: {
        maxWidth: 320,
        textAlign: "center",
    },
    emptyPrimaryButton: {
        minHeight: 46,
        minWidth: 132,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
        boxShadow: "0 2px 6px rgba(47, 111, 237, 0.22)",
    },
    emptyPrimaryButtonText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.72,
    },
    disabled: {
        opacity: 0.45,
    },
});
