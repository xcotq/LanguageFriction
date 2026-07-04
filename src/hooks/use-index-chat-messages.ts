import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createTextChatMessage } from "@/hooks/use-chat-session";
import type {
    ChatOperationStatus,
    ChatPreviewStatus,
    ChatSessionScreenStatus,
} from "@/hooks/index-chat-session-types";
import {
    createErrorReply,
    createMockReply,
    getComposerActionStatus,
    getSendActionStatus,
} from "@/hooks/index-chat-session-utils";
import type { LanguageModelStatus } from "@/providers/language-model-provider";
import { sendLanguageFrictionMessage } from "@/services/language-model";
import type { ChatMessage, ChatSession } from "@/types/domain";

type UseIndexChatMessagesOptions = {
    selectedSessionId: string | null;
    session: ChatSession | null;
    messages: ChatMessage[];
    isSessionLoading: boolean;
    sessionStatus: ChatSessionScreenStatus;
    operationStatus: ChatOperationStatus;
    previewStatus: ChatPreviewStatus;
    isModelStatusLoading: boolean;
    modelStatus: LanguageModelStatus;
    appendMessage: (message: ChatMessage) => Promise<void>;
};

export function useIndexChatMessages({
    selectedSessionId,
    session,
    messages,
    isSessionLoading,
    sessionStatus,
    operationStatus,
    previewStatus,
    isModelStatusLoading,
    modelStatus,
    appendMessage,
}: UseIndexChatMessagesOptions) {
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let isCurrent = true;

        Promise.resolve().then(() => {
            if (isCurrent) {
                setInput("");
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [selectedSessionId]);

    const composerActionStatus = getComposerActionStatus({
        sessionStatus,
        isLoading: isSessionLoading,
        isSending,
        isModelStatusLoading,
        operationStatus,
        previewStatus,
    });
    const sendActionStatus = getSendActionStatus({
        input,
        composerActionStatus,
    });

    const send = useCallback(async () => {
        const text = input.trim();

        if (
            !text ||
            !session ||
            session.status !== "active" ||
            isSending ||
            isSessionLoading ||
            sendActionStatus !== "enabled"
        ) {
            return false;
        }

        const userMessage = createTextChatMessage({
            sessionId: session.id,
            role: "user",
            sequence: messages.length + 1,
            content: text,
        });
        const nextMessages = [...messages, userMessage];

        setInput("");
        setIsSending(true);

        try {
            await appendMessage(userMessage);

            const assistantText = modelStatus.configured
                ? await sendLanguageFrictionMessage(messages, text)
                : createMockReply(text);
            const assistantMessage = createTextChatMessage({
                sessionId: session.id,
                role: "assistant",
                sequence: nextMessages.length + 1,
                content: assistantText,
            });

            await appendMessage(assistantMessage);
        } catch (error) {
            console.log(error);
            const errorMessage = createTextChatMessage({
                sessionId: session.id,
                role: "assistant",
                sequence: nextMessages.length + 1,
                content: createErrorReply(error),
            });

            await appendMessage(errorMessage).catch(() => undefined);
        } finally {
            if (isMountedRef.current) {
                setIsSending(false);
            }
        }

        return true;
    }, [
        appendMessage,
        input,
        isSending,
        isSessionLoading,
        messages,
        modelStatus.configured,
        sendActionStatus,
        session,
    ]);

    return useMemo(
        () => ({
            input,
            isSending,
            status: {
                composerAction: composerActionStatus,
                sendAction: sendActionStatus,
            },
            actions: {
                setInput,
                send,
            },
        }),
        [composerActionStatus, input, isSending, send, sendActionStatus]
    );
}
