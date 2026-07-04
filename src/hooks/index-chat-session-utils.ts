import type { ChatSession } from "@/types/domain";
import type {
    ChatActionStatus,
    ChatOperationStatus,
    ChatPreviewStatus,
    ChatSessionScreenStatus,
    ChatWorkflowStatus,
} from "@/hooks/index-chat-session-types";

export function getRouteSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? null;
    }

    return sessionId?.trim() ? sessionId : null;
}

export function createMockReply(userText: string) {
    return [
        "A natural first pass:",
        "",
        `> ${userText.trim() ? "Could I say it like this in context?" : "Could you give me a bit more context?"}`,
        "",
        "I will keep the useful wording concrete so it can become a reviewable knowledge point later.",
    ].join("\n");
}

export function createErrorReply(error: unknown) {
    const message =
        error instanceof Error ? error.message : "The model request failed.";
    return `**Model request failed**\n\n${message}`;
}

export function getActionStatus(enabled: boolean): ChatActionStatus {
    return enabled ? "enabled" : "disabled";
}

export function getSessionScreenStatus({
    isLoading,
    session,
}: {
    isLoading: boolean;
    session: ChatSession | null;
}): ChatSessionScreenStatus {
    if (isLoading) {
        return "loading";
    }

    return session?.status ?? "empty";
}

export function getComposerActionStatus({
    sessionStatus,
    isLoading,
    isSending,
    isModelStatusLoading,
    operationStatus,
    previewStatus,
}: {
    sessionStatus: ChatSessionScreenStatus;
    isLoading: boolean;
    isSending: boolean;
    isModelStatusLoading: boolean;
    operationStatus: ChatOperationStatus;
    previewStatus: ChatPreviewStatus;
}): ChatActionStatus {
    return getActionStatus(
        sessionStatus === "active" &&
            !isLoading &&
            !isSending &&
            !isModelStatusLoading &&
            operationStatus === "idle" &&
            previewStatus !== "pending"
    );
}

export function getSendActionStatus({
    input,
    composerActionStatus,
}: {
    input: string;
    composerActionStatus: ChatActionStatus;
}): ChatActionStatus {
    return getActionStatus(
        Boolean(input.trim()) && composerActionStatus === "enabled"
    );
}

export function getEndSessionActionStatus({
    sessionStatus,
    isSending,
    operationStatus,
}: {
    sessionStatus: ChatSessionScreenStatus;
    isSending: boolean;
    operationStatus: ChatOperationStatus;
}): ChatActionStatus {
    return getActionStatus(
        sessionStatus === "active" && !isSending && operationStatus === "idle"
    );
}

export function getCreateSessionActionStatus({
    operationStatus,
}: {
    operationStatus: ChatOperationStatus;
}): ChatActionStatus {
    return getActionStatus(operationStatus === "idle");
}

export function getWorkflowStatus({
    operationStatus,
    previewStatus,
    sessionStatus,
    isModelStatusLoading,
}: {
    operationStatus: ChatOperationStatus;
    previewStatus: ChatPreviewStatus;
    sessionStatus: ChatSessionScreenStatus;
    isModelStatusLoading: boolean;
}): ChatWorkflowStatus {
    if (operationStatus === "extracting") {
        return "extracting";
    }

    if (operationStatus === "committing") {
        return "committing";
    }

    if (previewStatus === "pending") {
        return "preview_pending";
    }

    if (previewStatus === "empty") {
        return "preview_empty";
    }

    if (previewStatus === "saved") {
        return "knowledge_saved";
    }

    if (sessionStatus === "closed") {
        return "closed";
    }

    if (sessionStatus === "archived") {
        return "archived";
    }

    return isModelStatusLoading ? "model_loading" : "model_ready";
}

export function getWorkflowLabel({
    workflowStatus,
    previewCount,
    modelLabel,
}: {
    workflowStatus: ChatWorkflowStatus;
    previewCount: number;
    modelLabel: string;
}) {
    if (workflowStatus === "extracting") {
        return "Extracting knowledge...";
    }

    if (workflowStatus === "committing") {
        return "Saving knowledge...";
    }

    if (workflowStatus === "preview_pending") {
        return `${previewCount} pending`;
    }

    if (workflowStatus === "preview_empty") {
        return "No candidates";
    }

    if (workflowStatus === "knowledge_saved") {
        return "Knowledge saved";
    }

    if (workflowStatus === "closed") {
        return "Closed";
    }

    if (workflowStatus === "archived") {
        return "Archived";
    }

    if (workflowStatus === "model_loading") {
        return "Loading model...";
    }

    return modelLabel;
}
