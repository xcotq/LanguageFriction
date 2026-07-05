import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";

import { showAlert } from "@/components/ui/platform-alert";
import { useRepositories } from "@/data/repositories";
import type {
    ChatOperationStatus,
    ChatPreviewStatus,
} from "@/hooks/index-chat-session-types";
import {
    approveSessionExtractionPreview,
    buildTranscriptSnapshot,
    runSessionExtractionWorkflow,
    type SessionExtractionPreview,
} from "@/services/session-extraction";
import type { ChatSession } from "@/types/domain";

type UseIndexSessionControllerOptions = {
    selectedSessionId: string | null;
    session: ChatSession | null;
    modelConfigured: boolean;
    createStoredSession: (title?: string) => Promise<ChatSession>;
    closeStoredSession: (sessionId?: string) => Promise<ChatSession | null>;
};

export function useIndexSessionController({
    selectedSessionId,
    session,
    modelConfigured,
    createStoredSession,
    closeStoredSession,
}: UseIndexSessionControllerOptions) {
    const router = useRouter();
    const { knowledge: knowledgeRepository } = useRepositories();
    const [operationStatus, setOperationStatus] =
        useState<ChatOperationStatus>("idle");
    const [previewStatus, setPreviewStatus] =
        useState<ChatPreviewStatus>("idle");
    const [extractionPreview, setExtractionPreview] =
        useState<SessionExtractionPreview | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let isCurrent = true;

        Promise.resolve().then(() => {
            if (!isCurrent) {
                return;
            }

            setExtractionPreview(null);
            setPreviewStatus("idle");
        });

        return () => {
            isCurrent = false;
        };
    }, [selectedSessionId]);

    const createSession = useCallback(async () => {
        if (operationStatus !== "idle") {
            return;
        }

        setOperationStatus("creating");

        try {
            const nextSession = await createStoredSession();

            if (isMountedRef.current) {
                setPreviewStatus("idle");
                setExtractionPreview(null);
                router.replace({
                    pathname: "/",
                    params: { sessionId: nextSession.id },
                });
            }
        } catch (error) {
            console.error("Failed to create session", error);
            showAlert("Create failed", "The session could not be created.");
        } finally {
            if (isMountedRef.current) {
                setOperationStatus("idle");
            }
        }
    }, [createStoredSession, operationStatus, router]);

    const endSession = useCallback(async () => {
        if (
            !session ||
            session.status !== "active" ||
            operationStatus !== "idle"
        ) {
            return;
        }

        setOperationStatus("extracting");
        setExtractionPreview(null);
        setPreviewStatus("idle");

        try {
            const closedSession = await closeStoredSession(session.id);

            if (!closedSession) {
                throw new Error("Session was not found.");
            }

            const snapshot = buildTranscriptSnapshot(closedSession);
            const preview = await runSessionExtractionWorkflow({
                snapshot,
                knowledgeRepository,
                useModel: modelConfigured,
            });

            if (isMountedRef.current) {
                setExtractionPreview(preview);
                setPreviewStatus(
                    preview.inquiryPreviews.length > 0 ? "pending" : "empty"
                );

                if (preview.inquiryPreviews.length === 0) {
                    showAlert(
                        "Nothing to save",
                        "No durable language inquiry was extracted from this session."
                    );
                }
            }
        } catch (error) {
            console.error("Failed to end session", error);
            if (isMountedRef.current) {
                showAlert(
                    "End failed",
                    "The session could not be closed or extracted."
                );
            }
        } finally {
            if (isMountedRef.current) {
                setOperationStatus("idle");
            }
        }
    }, [
        closeStoredSession,
        knowledgeRepository,
        modelConfigured,
        operationStatus,
        session,
    ]);

    const confirmExtraction = useCallback(async () => {
        if (
            !extractionPreview ||
            extractionPreview.inquiryPreviews.length === 0 ||
            operationStatus !== "idle"
        ) {
            return;
        }

        setOperationStatus("committing");

        try {
            const approvedExtraction =
                approveSessionExtractionPreview(extractionPreview);
            await knowledgeRepository.saveSessionExtraction(approvedExtraction);

            if (isMountedRef.current) {
                setExtractionPreview(null);
                setPreviewStatus("saved");

                const savedCount = approvedExtraction.inquiries.length;
                showAlert(
                    "Saved",
                    savedCount === 1
                        ? "1 inquiry preview was saved."
                        : `${savedCount} inquiry previews were saved.`
                );
            }
        } catch (error) {
            console.error("Failed to save extraction", error);
            if (isMountedRef.current) {
                showAlert(
                    "Save failed",
                    "The approved knowledge preview could not be saved."
                );
            }
        } finally {
            if (isMountedRef.current) {
                setOperationStatus("idle");
            }
        }
    }, [extractionPreview, knowledgeRepository, operationStatus]);

    const cancelExtraction = useCallback(() => {
        setExtractionPreview(null);
        setPreviewStatus("idle");
    }, []);

    const currentSessionId = session?.id;

    const openHistory = useCallback(() => {
        if (currentSessionId) {
            router.push({
                pathname: "/history",
                params: { sessionId: currentSessionId },
            });
            return;
        }

        router.push("/history");
    }, [currentSessionId, router]);

    return useMemo(
        () => ({
            operationStatus,
            previewStatus,
            extractionPreview,
            actions: {
                createSession,
                endSession,
                confirmExtraction,
                cancelExtraction,
                openHistory,
            },
        }),
        [
            cancelExtraction,
            confirmExtraction,
            createSession,
            endSession,
            extractionPreview,
            openHistory,
            operationStatus,
            previewStatus,
        ]
    );
}
