import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatSessionArea } from "@/components/chat/chat-session-area";
import { ExtractionPreviewPanel } from "@/components/chat/extraction-preview-panel";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import { useIndexChatSession } from "@/hooks/use-index-chat-session";

const CURRENT_USER_ID = "mock-user";

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const chat = useIndexChatSession({ userId: CURRENT_USER_ID });
    const hasSession = Boolean(chat.session);
    const composerVisible =
        chat.status.session === "loading" || chat.status.session === "active";

    return (
        <ThemedView style={styles.screen}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
                style={styles.keyboardView}
            >
                <View
                    style={[
                        styles.content,
                        {
                            paddingTop: insets.top + TopTabInset,
                            paddingBottom: insets.bottom + Spacing.two,
                        },
                    ]}
                >
                    <ChatHeader
                        sessionExists={hasSession}
                        sessionStatus={chat.status.session}
                        operationStatus={chat.status.operation}
                        sessionLabel={chat.labels.session}
                        workflowLabel={chat.labels.workflow}
                        endSessionActionStatus={chat.status.endSessionAction}
                        createSessionActionStatus={
                            chat.status.createSessionAction
                        }
                        onCreateSession={chat.actions.createSession}
                        onEndSession={chat.actions.endSession}
                        onOpenHistory={chat.actions.openHistory}
                    />

                    <ChatSessionArea
                        isLoading={chat.status.session === "loading"}
                        messages={chat.messages}
                        sessionExists={hasSession}
                        createSessionActionStatus={
                            chat.status.createSessionAction
                        }
                        operationStatus={chat.status.operation}
                        onCreateSession={chat.actions.createSession}
                    />

                    {chat.extractionPreview ? (
                        <ExtractionPreviewPanel
                            preview={chat.extractionPreview}
                            isCommitting={
                                chat.status.operation === "committing"
                            }
                            onCancel={chat.actions.cancelExtraction}
                            onConfirm={chat.actions.confirmExtraction}
                        />
                    ) : null}

                    <ChatComposer
                        visible={composerVisible}
                        bottomInset={insets.bottom}
                        input={chat.input}
                        composerActionStatus={chat.status.composerAction}
                        sendActionStatus={chat.status.sendAction}
                        onChangeInput={chat.actions.setInput}
                        onSend={chat.actions.send}
                    />
                </View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        width: "100%",
        maxWidth: MaxContentWidth,
        alignSelf: "center",
        paddingHorizontal: Spacing.three,
        gap: Spacing.three,
    },
});
