import type { SQLiteDatabase } from "expo-sqlite";

import { runWriteTransaction } from "@/data/database/transaction";
import {
    composeChatMessages,
    ContentBlockDao,
    MessageDao,
    SessionDao,
} from "@/data/dao/raw.dao";
import type { ChatMessage, ChatSession, Session } from "@/types/domain";

function getLastMessageAt(session: ChatSession): Date {
    return session.messages.reduce(
        (latest, message) =>
            message.createdAt > latest ? message.createdAt : latest,
        session.lastMessageAt
    );
}

export class ChatSessionRepository {
    constructor(private readonly db: SQLiteDatabase) {}

    async createSession(
        userId: string,
        title = "New session"
    ): Promise<ChatSession> {
        const now = new Date();
        const id = `session-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
        const session: ChatSession = {
            id,
            userId,
            title,
            startedAt: now,
            lastMessageAt: now,
            status: "active",
            messages: [],
        };

        await this.saveSession(session);
        return session;
    }

    async archiveSession(sessionId: string): Promise<ChatSession | null> {
        const session = await this.getById(sessionId);

        if (!session) {
            return null;
        }

        const archivedSession: ChatSession = {
            ...session,
            endedAt: new Date(),
            status: "archived",
        };

        await this.saveSession(archivedSession);
        return archivedSession;
    }

    async closeSession(sessionId: string): Promise<ChatSession | null> {
        const session = await this.getById(sessionId);

        if (!session) {
            return null;
        }

        const closedSession: ChatSession = {
            ...session,
            endedAt: session.endedAt ?? new Date(),
            status: "closed",
        };

        await this.saveSession(closedSession);
        return closedSession;
    }

    async saveSession(session: ChatSession): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            const sessionDao = new SessionDao(tx);
            const messageDao = new MessageDao(tx);
            const blockDao = new ContentBlockDao(tx);

            await sessionDao.upsert({
                ...session,
                lastMessageAt: getLastMessageAt(session),
            });

            for (const message of session.messages) {
                await messageDao.upsert(message);

                for (const block of message.blocks) {
                    await blockDao.upsert(block);
                }
            }
        });
    }

    async saveSessionSummary(session: Session): Promise<void> {
        await new SessionDao(this.db).upsert(session);
    }

    async appendMessage(message: ChatMessage): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            const sessionDao = new SessionDao(tx);
            const messageDao = new MessageDao(tx);
            const blockDao = new ContentBlockDao(tx);

            await messageDao.upsert(message);
            await sessionDao.touchLastMessageAt(
                message.sessionId,
                message.createdAt
            );

            for (const block of message.blocks) {
                await blockDao.upsert(block);
            }
        });
    }

    async getById(sessionId: string): Promise<ChatSession | null> {
        const sessionDao = new SessionDao(this.db);
        const messageDao = new MessageDao(this.db);
        const blockDao = new ContentBlockDao(this.db);

        const session = await sessionDao.getById(sessionId);

        if (!session) {
            return null;
        }

        const messages = await messageDao.getBySessionId(sessionId);
        const blocks = await blockDao.getByMessageIds(
            messages.map((message) => message.id)
        );

        return {
            ...session,
            messages: composeChatMessages(messages, blocks),
        };
    }

    async listSessions(userId?: string, limit = 50): Promise<Session[]> {
        const sessionDao = new SessionDao(this.db);
        return userId
            ? sessionDao.listByUser(userId, limit)
            : sessionDao.listRecent(limit);
    }

    async listChatSessions(
        userId?: string,
        limit = 50
    ): Promise<ChatSession[]> {
        const sessions = await this.listSessions(userId, limit);
        const chatSessions = await Promise.all(
            sessions.map((session) => this.getById(session.id))
        );

        return chatSessions.filter((session): session is ChatSession =>
            Boolean(session)
        );
    }

    async getLatestByUser(userId: string): Promise<ChatSession | null> {
        return (await this.listChatSessions(userId, 1))[0] ?? null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        console.log(sessionId);
        await new SessionDao(this.db).deleteById(sessionId);
    }

    async getNextMessageSequence(sessionId: string): Promise<number> {
        return new MessageDao(this.db).getNextSequence(sessionId);
    }
}
