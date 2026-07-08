import type { SessionExtractionPreview } from "@/services/session-extraction";
import type { ChatMessage, ChatSession, SessionStatus } from "@/types/domain";

export type ChatActionStatus = "enabled" | "disabled";

export type ChatOperationStatus =
    "idle" | "creating" | "generating_preview" | "confirming_preview";

export type ChatPreviewStatus = "idle" | "pending" | "empty" | "saved";

export type ChatSessionScreenStatus = "loading" | "empty" | SessionStatus;

export type ChatWorkflowStatus =
    | "generating_preview"
    | "confirming_preview"
    | "preview_pending"
    | "preview_empty"
    | "knowledge_saved"
    | "closed"
    | "archived"
    | "model_loading"
    | "model_ready";

export type UseIndexChatSessionOptions = {
    userId: string;
};

export type IndexChatSessionState = {
    session: ChatSession | null;
    messages: ChatMessage[];
    input: string;
    extractionPreview: SessionExtractionPreview | null;
    labels: {
        session: string;
        workflow: string;
    };
    status: {
        session: ChatSessionScreenStatus;
        operation: ChatOperationStatus;
        preview: ChatPreviewStatus;
        workflow: ChatWorkflowStatus;
        composerAction: ChatActionStatus;
        sendAction: ChatActionStatus;
        generateExtractionPreviewAction: ChatActionStatus;
        createSessionAction: ChatActionStatus;
    };
    actions: {
        setInput: (text: string) => void;
        send: () => Promise<boolean>;
        createSession: () => Promise<void>;
        generateExtractionPreview: () => Promise<void>;
        confirmExtractionPreview: () => Promise<void>;
        cancelExtractionPreview: () => void;
        openHistory: () => void;
    };
};
