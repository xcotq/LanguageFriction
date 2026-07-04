import { Pressable, StyleSheet, TextInput } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { ChatActionStatus } from "@/hooks/index-chat-session-types";
import { useTheme } from "@/hooks/use-theme";

export function ChatComposer({
    bottomInset,
    input,
    composerActionStatus,
    sendActionStatus,
    visible,
    onChangeInput,
    onSend,
}: {
    bottomInset: number;
    input: string;
    composerActionStatus: ChatActionStatus;
    sendActionStatus: ChatActionStatus;
    visible: boolean;
    onChangeInput: (text: string) => void;
    onSend: () => void;
}) {
    const theme = useTheme();

    if (!visible) {
        return null;
    }

    const composerDisabled = composerActionStatus !== "enabled";
    const sendDisabled = sendActionStatus !== "enabled";

    return (
        <ThemedView
            type="backgroundElement"
            style={[styles.composer, { bottom: bottomInset }]}
        >
            <TextInput
                value={input}
                onChangeText={onChangeInput}
                editable={!composerDisabled}
                multiline
                placeholder="Ask a tiny expression question..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="sentences"
                style={[
                    styles.input,
                    {
                        color: theme.text,
                        backgroundColor: theme.background,
                        borderColor: theme.backgroundSelected,
                    },
                ]}
            />
            <Pressable
                accessibilityRole="button"
                onPress={onSend}
                disabled={sendDisabled}
                style={({ pressed }) => [
                    styles.sendButton,
                    pressed && styles.pressed,
                    sendDisabled && styles.disabled,
                ]}
            >
                <ThemedText type="smallBold" style={styles.sendButtonText}>
                    Send
                </ThemedText>
            </Pressable>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    composer: {
        position: "absolute",
        left: Spacing.three,
        right: Spacing.three,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: Spacing.two,
        padding: Spacing.two,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    input: {
        flex: 1,
        minHeight: 46,
        maxHeight: 132,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.three,
        paddingVertical: 10,
        fontSize: 16,
        lineHeight: 22,
    },
    sendButton: {
        minWidth: 58,
        height: 46,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.two,
    },
    sendButtonText: {
        color: "#ffffff",
    },
    pressed: {
        opacity: 0.72,
    },
    disabled: {
        opacity: 0.45,
    },
});
