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
    getGenerateExtractionPreviewActionStatus,
    getRouteSessionId,
    getSessionScreenStatus,
    getWorkflowLabel,
    getWorkflowStatus,
} from "@/hooks/index-chat-session-utils";
import { useLanguageModelState } from "@/providers/language-model-state";
import { useLanguagePreferenceState } from "@/providers/language-preference-state";

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
    const { settings: languagePreferences } = useLanguagePreferenceState();
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
            generateExtractionPreview: generateExtractionPreviewRequest,
            confirmExtractionPreview,
            cancelExtractionPreview,
            openHistory,
        },
    } = useIndexSessionController({
        selectedSessionId,
        session,
        languagePreferences,
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
        languagePreferences,
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
    const generateExtractionPreviewActionStatus =
        getGenerateExtractionPreviewActionStatus({
            sessionStatus,
            isSending,
            operationStatus,
            previewStatus,
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

    const generateExtractionPreview = useCallback(async () => {
        if (generateExtractionPreviewActionStatus !== "enabled") {
            return;
        }

        await generateExtractionPreviewRequest();
    }, [
        generateExtractionPreviewActionStatus,
        generateExtractionPreviewRequest,
    ]);

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
                generateExtractionPreviewAction:
                    generateExtractionPreviewActionStatus,
                createSessionAction: createSessionActionStatus,
            },
            actions: {
                setInput,
                send,
                createSession,
                generateExtractionPreview,
                confirmExtractionPreview,
                cancelExtractionPreview,
                openHistory,
            },
        }),
        [
            cancelExtractionPreview,
            composerActionStatus,
            confirmExtractionPreview,
            createSession,
            createSessionActionStatus,
            extractionPreview,
            generateExtractionPreview,
            generateExtractionPreviewActionStatus,
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
