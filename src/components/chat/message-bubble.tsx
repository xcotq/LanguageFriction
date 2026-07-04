import { StyleSheet, View } from "react-native";

import { MarkdownMessage } from "@/components/chat/markdown-message";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ChatMessage } from "@/types/domain";

type MessageBubbleProps = {
  message: ChatMessage;
};

function getMessageText(message: ChatMessage) {
  return message.blocks
    .filter((block) => block.type === "text")
    .map((block) => String(block.content))
    .join("\n\n");
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const theme = useTheme();
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? "#2f6fed" : theme.backgroundElement,
            borderColor: isUser ? "#2f6fed" : theme.backgroundSelected,
          },
        ]}>
        <ThemedText
          type="smallBold"
          themeColor={isUser ? undefined : "textSecondary"}
          style={[styles.role, isUser && styles.userRole]}>
          {isUser ? "You" : "LanguageFriction"}
        </ThemedText>
        <MarkdownMessage inverse={isUser}>{getMessageText(message)}</MarkdownMessage>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
  },
  assistantContainer: {
    justifyContent: "flex-start",
  },
  userContainer: {
    justifyContent: "flex-end",
  },
  bubble: {
    width: "100%",
    maxWidth: 720,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  role: {
    marginBottom: Spacing.one,
  },
  userRole: {
    color: "rgba(255, 255, 255, 0.72)",
  },
});
