import type { InquirySlice, TranscriptSnapshot } from "./types";
import { truncateText } from "./stable";

export function firstUserMessage(snapshot: TranscriptSnapshot) {
    return snapshot.messages.find(
        (message) => message.role === "user" && message.text.trim()
    );
}

export function assistantMessages(snapshot: TranscriptSnapshot) {
    return snapshot.messages.filter(
        (message) => message.role === "assistant" && message.text.trim()
    );
}

export function includesCjk(text: string) {
    return /[\u3400-\u9fff]/.test(text);
}

export function inferSourceLanguage(text: string) {
    return includesCjk(text) ? "zh-CN" : undefined;
}

export function inferRecommendedUtterance(snapshot: TranscriptSnapshot) {
    const assistantText = assistantMessages(snapshot)
        .map((message) => message.text)
        .join("\n\n");
    const quoteMatch = assistantText.match(/^\s*>\s*(.+)$/m);
    const codeMatch = assistantText.match(/`([^`\n]{8,160})`/);

    return (quoteMatch?.[1] ?? codeMatch?.[1] ?? "").trim();
}

export function createDefaultMessageLinks(
    snapshot: TranscriptSnapshot
): InquirySlice["messageLinks"] {
    const firstUser = firstUserMessage(snapshot);
    const firstAssistant = assistantMessages(snapshot)[0];
    const links: InquirySlice["messageLinks"] = [];

    if (firstUser) {
        links.push({
            messageId: firstUser.id,
            role: "primary_question",
            sequence: 1,
        });
    }

    if (firstAssistant) {
        links.push({
            messageId: firstAssistant.id,
            role: "answer",
            sequence: 2,
        });
    }

    return links;
}

export function titleFromRecommendedUtterance(
    snapshot: TranscriptSnapshot,
    fallbackText: string
) {
    const recommendedUtterance = inferRecommendedUtterance(snapshot);

    return recommendedUtterance
        ? `Learn: ${truncateText(recommendedUtterance, 58)}`
        : truncateText(fallbackText, 58);
}
