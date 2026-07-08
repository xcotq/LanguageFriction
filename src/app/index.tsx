import { useCallback, useState } from "react";
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
const MIN_COMPOSER_HEIGHT = 64;

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const [composerHeight, setComposerHeight] = useState(MIN_COMPOSER_HEIGHT);
    const chat = useIndexChatSession({ userId: CURRENT_USER_ID });
    const hasSession = Boolean(chat.session);
    const composerVisible =
        chat.status.session === "loading" || chat.status.session === "active";
    const previewBottomGap = composerVisible
        ? Math.max(composerHeight, MIN_COMPOSER_HEIGHT) + Spacing.two
        : 0;

    const handleComposerHeightChange = useCallback((height: number) => {
        const nextHeight = Math.ceil(height);

        setComposerHeight((currentHeight) =>
            currentHeight === nextHeight ? currentHeight : nextHeight
        );
    }, []);

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
                        generateExtractionPreviewActionStatus={
                            chat.status.generateExtractionPreviewAction
                        }
                        createSessionActionStatus={
                            chat.status.createSessionAction
                        }
                        onCreateSession={chat.actions.createSession}
                        onGenerateExtractionPreview={
                            chat.actions.generateExtractionPreview
                        }
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
                        <View style={{ marginBottom: previewBottomGap }}>
                            <ExtractionPreviewPanel
                                preview={chat.extractionPreview}
                                isConfirming={
                                    chat.status.operation ===
                                    "confirming_preview"
                                }
                                onCancel={chat.actions.cancelExtractionPreview}
                                onConfirm={
                                    chat.actions.confirmExtractionPreview
                                }
                            />
                        </View>
                    ) : null}

                    <ChatComposer
                        visible={composerVisible}
                        bottomInset={insets.bottom}
                        input={chat.input}
                        composerActionStatus={chat.status.composerAction}
                        sendActionStatus={chat.status.sendAction}
                        onChangeInput={chat.actions.setInput}
                        onHeightChange={handleComposerHeightChange}
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
