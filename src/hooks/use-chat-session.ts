import { useCallback, useEffect, useRef, useState } from "react";

import { useRepositories } from "@/data/repositories";
import type { ChatMessage, ChatSession, MessageRole } from "@/types/domain";

export type UseChatSessionOptions = {
    userId: string;
    sessionId?: string | null;
    autoLoad?: boolean;
};

export type UseChatSessionState = {
    session: ChatSession | null;
    messages: ChatMessage[];
    isLoading: boolean;
    loadError: unknown;
};

function getLastMessageAt(session: ChatSession, messages: ChatMessage[]) {
    return messages.reduce(
        (latest, message) =>
            message.createdAt > latest ? message.createdAt : latest,
        session.lastMessageAt
    );
}

function upsertMessage(messages: ChatMessage[], message: ChatMessage) {
    const messageIndex = messages.findIndex((item) => item.id === message.id);

    if (messageIndex < 0) {
        return [...messages, message];
    }

    const nextMessages = [...messages];
    nextMessages[messageIndex] = message;
    return nextMessages;
}

function upsertSessionMessage(session: ChatSession, message: ChatMessage) {
    const messages = upsertMessage(session.messages, message);

    return {
        ...session,
        messages,
        lastMessageAt: getLastMessageAt(session, messages),
    };
}

export function createTextChatMessage({
    sessionId,
    role,
    sequence,
    content,
}: {
    sessionId: string;
    role: MessageRole;
    sequence: number;
    content: string;
}): ChatMessage {
    const id = `${role}-${Date.now()}-${sequence}`;

    return {
        id,
        sessionId,
        role,
        sequence,
        createdAt: new Date(),
        blocks: [
            {
                id: `${id}-text`,
                messageId: id,
                type: "text",
                content,
                sequence: 1,
            },
        ],
    };
}

export function useChatSession({
    userId,
    sessionId = null,
    autoLoad = true,
}: UseChatSessionOptions) {
    const { chatSession: chatRepository } = useRepositories();
    const [session, setSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(autoLoad);
    const [loadError, setLoadError] = useState<unknown>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const setCurrentSession = useCallback((nextSession: ChatSession | null) => {
        setSession(nextSession);
        setMessages(nextSession?.messages ?? []);
    }, []);

    const loadSession = useCallback(
        async (nextSessionId?: string | null) => {
            setIsLoading(true);
            setLoadError(null);

            try {
                const loadedSession = nextSessionId
                    ? await chatRepository.getById(nextSessionId)
                    : await chatRepository.getLatestByUser(userId);

                if (isMountedRef.current) {
                    setCurrentSession(loadedSession);
                }

                return loadedSession;
            } catch (error) {
                if (isMountedRef.current) {
                    setLoadError(error);
                }

                throw error;
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [chatRepository, setCurrentSession, userId]
    );

    useEffect(() => {
        if (!autoLoad) {
            return;
        }

        let isCurrent = true;

        Promise.resolve().then(() => {
            if (!isCurrent) {
                return;
            }

            loadSession(sessionId).catch((error) => {
                console.error("Failed to load chat session", error);
            });
        });

        return () => {
            isCurrent = false;
        };
    }, [autoLoad, loadSession, sessionId]);

    const reload = useCallback(
        () => loadSession(sessionId),
        [loadSession, sessionId]
    );

    const createSession = useCallback(
        async (title?: string) => {
            const nextSession = await chatRepository.createSession(
                userId,
                title
            );

            if (isMountedRef.current) {
                setCurrentSession(nextSession);
            }

            return nextSession;
        },
        [chatRepository, setCurrentSession, userId]
    );

    const appendMessage = useCallback(
        async (message: ChatMessage) => {
            if (isMountedRef.current) {
                setMessages((currentMessages) =>
                    upsertMessage(currentMessages, message)
                );
                setSession((currentSession) =>
                    currentSession?.id === message.sessionId
                        ? upsertSessionMessage(currentSession, message)
                        : currentSession
                );
            }

            await chatRepository.appendMessage(message);
        },
        [chatRepository]
    );

    const currentSessionId = session?.id;

    const closeSession = useCallback(
        async (targetSessionId?: string) => {
            const nextSessionId = targetSessionId ?? currentSessionId;

            if (!nextSessionId) {
                return null;
            }

            const closedSession =
                await chatRepository.closeSession(nextSessionId);

            if (
                isMountedRef.current &&
                closedSession &&
                closedSession.id === currentSessionId
            ) {
                setCurrentSession(closedSession);
            }

            return closedSession;
        },
        [chatRepository, currentSessionId, setCurrentSession]
    );

    return {
        session,
        messages,
        isLoading,
        loadError,
        actions: {
            loadSession,
            reload,
            setCurrentSession,
            createSession,
            appendMessage,
            closeSession,
        },
    };
}
