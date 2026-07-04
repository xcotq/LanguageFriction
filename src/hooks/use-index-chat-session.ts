import { useCallback, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import { useChatSession } from "@/hooks/use-chat-session";
import { useIndexChatMessages } from "@/hooks/use-index-chat-messages";
import { useIndexSessionController } from "@/hooks/use-index-session-controller";
import type {
    IndexChatSessionState,
    UseIndexChatSessionOptions,
} from "@/hooks/index-chat-session-types";
import {
    getCreateSessionActionStatus,
    getEndSessionActionStatus,
    getRouteSessionId,
    getSessionScreenStatus,
    getWorkflowLabel,
    getWorkflowStatus,
} from "@/hooks/index-chat-session-utils";
import { useLanguageModelState } from "@/providers/language-model-state";

export function useIndexChatSession({
    userId,
}: UseIndexChatSessionOptions): IndexChatSessionState {
    const { sessionId } = useLocalSearchParams<{
        sessionId?: string | string[];
    }>();
    const selectedSessionId = getRouteSessionId(sessionId);
    const {
        session,
        messages,
        isLoading,
        actions: {
            createSession: createStoredSession,
            appendMessage,
            closeSession: closeStoredSession,
        },
    } = useChatSession({
        userId,
        sessionId: selectedSessionId,
    });
    const { isLoading: isModelStatusLoading, status: modelStatus } =
        useLanguageModelState();
    const sessionStatus = getSessionScreenStatus({
        isLoading,
        session,
    });
    const {
        operationStatus,
        previewStatus,
        extractionPreview,
        actions: {
            createSession: createSessionRequest,
            endSession: endSessionRequest,
            confirmExtraction,
            cancelExtraction,
            openHistory,
        },
    } = useIndexSessionController({
        selectedSessionId,
        session,
        modelConfigured: modelStatus.configured,
        createStoredSession,
        closeStoredSession,
    });
    const {
        input,
        isSending,
        status: {
            composerAction: composerActionStatus,
            sendAction: sendActionStatus,
        },
        actions: { setInput, send },
    } = useIndexChatMessages({
        selectedSessionId,
        session,
        messages,
        isSessionLoading: isLoading,
        sessionStatus,
        operationStatus,
        previewStatus,
        isModelStatusLoading,
        modelStatus,
        appendMessage,
    });
    const previewCount = extractionPreview?.inquiryPreviews.length ?? 0;
    const workflowStatus = getWorkflowStatus({
        operationStatus,
        previewStatus,
        sessionStatus,
        isModelStatusLoading,
    });
    const endSessionActionStatus = getEndSessionActionStatus({
        sessionStatus,
        isSending,
        operationStatus,
    });
    const createSessionActionStatus = getCreateSessionActionStatus({
        operationStatus,
    });

    const createSession = useCallback(async () => {
        if (createSessionActionStatus !== "enabled") {
            return;
        }

        await createSessionRequest();
    }, [createSessionActionStatus, createSessionRequest]);

    const endSession = useCallback(async () => {
        if (endSessionActionStatus !== "enabled") {
            return;
        }

        await endSessionRequest();
    }, [endSessionActionStatus, endSessionRequest]);

    return useMemo<IndexChatSessionState>(
        () => ({
            session,
            messages,
            input,
            extractionPreview,
            labels: {
                session: isLoading
                    ? "Loading session"
                    : (session?.title ?? "No session"),
                workflow: getWorkflowLabel({
                    workflowStatus,
                    previewCount,
                    modelLabel: modelStatus.label,
                }),
            },
            status: {
                session: sessionStatus,
                operation: operationStatus,
                preview: previewStatus,
                workflow: workflowStatus,
                composerAction: composerActionStatus,
                sendAction: sendActionStatus,
                endSessionAction: endSessionActionStatus,
                createSessionAction: createSessionActionStatus,
            },
            actions: {
                setInput,
                send,
                createSession,
                endSession,
                confirmExtraction,
                cancelExtraction,
                openHistory,
            },
        }),
        [
            cancelExtraction,
            composerActionStatus,
            confirmExtraction,
            createSession,
            createSessionActionStatus,
            endSession,
            endSessionActionStatus,
            extractionPreview,
            input,
            isLoading,
            messages,
            modelStatus.label,
            openHistory,
            operationStatus,
            previewCount,
            previewStatus,
            send,
            sendActionStatus,
            session,
            sessionStatus,
            setInput,
            workflowStatus,
        ]
    );
}
