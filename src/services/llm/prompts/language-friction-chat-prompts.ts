import type {
    CompletionInput,
    ProviderChatMessage,
} from "@/providers/language-model-provider";
import type { ChatMessage } from "@/types/domain";

export const LANGUAGE_FRICTION_CHAT_SYSTEM_PROMPT =
    "You are LanguageFriction, a concise language-learning assistant. Answer with clear Markdown and preserve useful expressions for later review.";

function messageText(message: ChatMessage) {
    return message.blocks
        .filter((block) => block.type === "text")
        .map((block) => String(block.content))
        .join("\n\n");
}

function historyMessage(message: ChatMessage): ProviderChatMessage {
    return {
        role: message.role,
        content: messageText(message),
    };
}

export function createLanguageFrictionChatPrompt({
    history,
    userText,
}: {
    history: ChatMessage[];
    userText: string;
}): CompletionInput {
    return [
        {
            role: "system",
            content: LANGUAGE_FRICTION_CHAT_SYSTEM_PROMPT,
        },
        ...history
            .filter((message) => message.role !== "system")
            .map(historyMessage),
        {
            role: "user",
            content: userText,
        },
    ];
}
