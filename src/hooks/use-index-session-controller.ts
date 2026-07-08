import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";

import { showAlert } from "@/components/ui/platform-alert";
import type { LanguagePreferenceSettings } from "@/constants/language-preferences";
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
    languagePreferences: LanguagePreferenceSettings;
    modelConfigured: boolean;
    createStoredSession: (title?: string) => Promise<ChatSession>;
    closeStoredSession: (sessionId?: string) => Promise<ChatSession | null>;
};

export function useIndexSessionController({
    selectedSessionId,
    session,
    languagePreferences,
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

    const generateExtractionPreview = useCallback(async () => {
        if (
            !session ||
            session.status !== "active" ||
            operationStatus !== "idle"
        ) {
            return;
        }

        setOperationStatus("generating_preview");
        setExtractionPreview(null);
        setPreviewStatus("idle");

        try {
            const snapshot = buildTranscriptSnapshot(session);
            const preview = await runSessionExtractionWorkflow({
                snapshot,
                knowledgeRepository,
                languagePreferences,
                useModel: modelConfigured,
            });

            if (preview.inquiryPreviews.length === 0) {
                if (isMountedRef.current) {
                    setExtractionPreview(preview);
                    setPreviewStatus("empty");
                    showAlert(
                        "Nothing to save",
                        "No durable language inquiry was extracted from this session."
                    );
                }

                return;
            }

            if (isMountedRef.current) {
                setExtractionPreview(preview);
                setPreviewStatus("pending");
            }
        } catch (error) {
            console.error("Failed to generate extraction preview", error);
            if (isMountedRef.current) {
                showAlert(
                    "Preview failed",
                    "The extraction preview could not be generated."
                );
            }
        } finally {
            if (isMountedRef.current) {
                setOperationStatus("idle");
            }
        }
    }, [
        knowledgeRepository,
        languagePreferences,
        modelConfigured,
        operationStatus,
        session,
    ]);

    const confirmExtractionPreview = useCallback(async () => {
        if (
            !extractionPreview ||
            extractionPreview.inquiryPreviews.length === 0 ||
            operationStatus !== "idle"
        ) {
            return;
        }

        setOperationStatus("confirming_preview");

        try {
            const approvedExtraction =
                approveSessionExtractionPreview(extractionPreview);
            await knowledgeRepository.saveSessionExtraction(approvedExtraction);

            const closedSession = await closeStoredSession(
                extractionPreview.sessionId
            );

            if (!closedSession) {
                throw new Error("Session was not found.");
            }

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
            console.error("Failed to confirm extraction", error);
            if (isMountedRef.current) {
                showAlert(
                    "Confirm failed",
                    "The approved knowledge preview could not be saved or the session could not be closed."
                );
            }
        } finally {
            if (isMountedRef.current) {
                setOperationStatus("idle");
            }
        }
    }, [
        closeStoredSession,
        extractionPreview,
        knowledgeRepository,
        operationStatus,
    ]);

    const cancelExtractionPreview = useCallback(() => {
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
                generateExtractionPreview,
                confirmExtractionPreview,
                cancelExtractionPreview,
                openHistory,
            },
        }),
        [
            cancelExtractionPreview,
            confirmExtractionPreview,
            createSession,
            extractionPreview,
            generateExtractionPreview,
            openHistory,
            operationStatus,
            previewStatus,
        ]
    );
}
