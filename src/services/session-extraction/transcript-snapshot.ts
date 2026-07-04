import type { ChatMessage, ChatSession, ContentBlock } from "@/types/domain";

import { stableHash, stableStringify } from "./stable";
import type { TranscriptSnapshot, TranscriptSnapshotMessage } from "./types";

function toIsoString(date: Date) {
    return date.toISOString();
}

function blockText(block: ContentBlock) {
    return typeof block.content === "string"
        ? block.content
        : JSON.stringify(block.content);
}

function buildMessageSnapshot(message: ChatMessage): TranscriptSnapshotMessage {
    const orderedBlocks = [...message.blocks].sort(
        (left, right) => left.sequence - right.sequence
    );

    return {
        id: message.id,
        role: message.role,
        sequence: message.sequence,
        createdAt: toIsoString(message.createdAt),
        text: orderedBlocks
            .filter((block) => block.type === "text")
            .map(blockText)
            .join("\n\n"),
        nonTextBlocks: orderedBlocks
            .filter(
                (
                    block
                ): block is ContentBlock & {
                    type: "image" | "audio" | "diagram" | "structured";
                } => block.type !== "text"
            )
            .map((block) => ({
                type: block.type,
                metadata: block.metadata,
                sequence: block.sequence,
            })),
    };
}

export function buildTranscriptSnapshot(
    session: ChatSession
): TranscriptSnapshot {
    const baseSnapshot = {
        sessionId: session.id,
        userId: session.userId,
        title: session.title,
        startedAt: toIsoString(session.startedAt),
        endedAt: session.endedAt ? toIsoString(session.endedAt) : undefined,
        messages: [...session.messages]
            .sort((left, right) => left.sequence - right.sequence)
            .map(buildMessageSnapshot),
    };

    return {
        ...baseSnapshot,
        transcriptHash: stableHash(stableStringify(baseSnapshot)),
    };
}
