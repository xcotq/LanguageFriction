import type { SQLiteDatabase } from "expo-sqlite";

import {
  dateToText,
  jsonToText,
  optionalDateToText,
  optionalJsonToText,
  optionalTextToDate,
  optionalTextToJson,
  textToDate,
  textToJson,
} from "@/data/database/serialization";
import type {
  ChatMessage,
  ContentBlock,
  ContentBlockType,
  Message,
  MessageRole,
  Session,
  SessionStatus,
} from "@/types/domain";

type SessionRow = {
  id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  last_message_at: string | null;
  status: SessionStatus;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: MessageRole;
  sequence: number;
  created_at: string;
};

type ContentBlockRow = {
  id: string;
  message_id: string;
  type: ContentBlockType;
  content_json: string;
  metadata_json: string | null;
  sequence: number;
};

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title ?? undefined,
    startedAt: textToDate(row.started_at),
    endedAt: optionalTextToDate(row.ended_at),
    lastMessageAt: textToDate(row.last_message_at ?? row.started_at),
    status: row.status,
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    sequence: row.sequence,
    createdAt: textToDate(row.created_at),
  };
}

function mapContentBlock(row: ContentBlockRow): ContentBlock {
  return {
    id: row.id,
    messageId: row.message_id,
    type: row.type,
    content: textToJson<unknown>(row.content_json),
    metadata: optionalTextToJson<Record<string, unknown>>(row.metadata_json),
    sequence: row.sequence,
  };
}

export class SessionDao {
  constructor(private readonly db: SQLiteDatabase) {}

  async upsert(session: Session): Promise<void> {
    const lastMessageAt = dateToText(session.lastMessageAt);

    await this.db.runAsync(
      `
INSERT INTO sessions (
  id, user_id, title, started_at, ended_at, last_message_at, status
) VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  title = excluded.title,
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  last_message_at = max(
    coalesce(sessions.last_message_at, excluded.last_message_at),
    excluded.last_message_at
  ),
  status = excluded.status
`,
      [
        session.id,
        session.userId,
        session.title ?? null,
        dateToText(session.startedAt),
        optionalDateToText(session.endedAt),
        lastMessageAt,
        session.status,
      ]
    );
  }

  async touchLastMessageAt(
    sessionId: string,
    lastMessageAt: Date
  ): Promise<void> {
    const lastMessageAtText = dateToText(lastMessageAt);

    await this.db.runAsync(
      `
UPDATE sessions
SET last_message_at = max(coalesce(last_message_at, ?), ?)
WHERE id = ?
`,
      [lastMessageAtText, lastMessageAtText, sessionId]
    );
  }

  async getById(id: string): Promise<Session | null> {
    const row = await this.db.getFirstAsync<SessionRow>(
      "SELECT * FROM sessions WHERE id = ?",
      [id]
    );
    return row ? mapSession(row) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.runAsync("DELETE FROM sessions WHERE id = ?", [id]);
  }

  async listByUser(userId: string, limit = 50): Promise<Session[]> {
    const rows = await this.db.getAllAsync<SessionRow>(
      `
SELECT *
FROM sessions
WHERE user_id = ?
ORDER BY last_message_at DESC
LIMIT ?
`,
      [userId, limit]
    );
    return rows.map(mapSession);
  }

  async listRecent(limit = 50): Promise<Session[]> {
    const rows = await this.db.getAllAsync<SessionRow>(
      `
SELECT *
FROM sessions
ORDER BY last_message_at DESC
LIMIT ?
`,
      [limit]
    );
    return rows.map(mapSession);
  }
}

export class MessageDao {
  constructor(private readonly db: SQLiteDatabase) {}

  async upsert(message: Message): Promise<void> {
    await this.db.runAsync(
      `
INSERT INTO messages (
  id, session_id, role, sequence, created_at
) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  session_id = excluded.session_id,
  role = excluded.role,
  sequence = excluded.sequence,
  created_at = excluded.created_at
`,
      [
        message.id,
        message.sessionId,
        message.role,
        message.sequence,
        dateToText(message.createdAt),
      ]
    );
  }

  async getBySessionId(sessionId: string): Promise<Message[]> {
    const rows = await this.db.getAllAsync<MessageRow>(
      `
SELECT *
FROM messages
WHERE session_id = ?
ORDER BY sequence ASC
`,
      [sessionId]
    );
    return rows.map(mapMessage);
  }

  async getNextSequence(sessionId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ next_sequence: number }>(
      `
SELECT coalesce(max(sequence), 0) + 1 AS next_sequence
FROM messages
WHERE session_id = ?
`,
      [sessionId]
    );

    return row?.next_sequence ?? 1;
  }
}

export class ContentBlockDao {
  constructor(private readonly db: SQLiteDatabase) {}

  async upsert(block: ContentBlock): Promise<void> {
    await this.db.runAsync(
      `
INSERT INTO content_blocks (
  id, message_id, type, content_json, metadata_json, sequence
) VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  message_id = excluded.message_id,
  type = excluded.type,
  content_json = excluded.content_json,
  metadata_json = excluded.metadata_json,
  sequence = excluded.sequence
`,
      [
        block.id,
        block.messageId,
        block.type,
        jsonToText(block.content),
        optionalJsonToText(block.metadata),
        block.sequence,
      ]
    );
  }

  async getByMessageId(messageId: string): Promise<ContentBlock[]> {
    const rows = await this.db.getAllAsync<ContentBlockRow>(
      `
SELECT *
FROM content_blocks
WHERE message_id = ?
ORDER BY sequence ASC
`,
      [messageId]
    );
    return rows.map(mapContentBlock);
  }

  async getByMessageIds(messageIds: string[]): Promise<ContentBlock[]> {
    if (messageIds.length === 0) {
      return [];
    }

    const placeholders = messageIds.map(() => "?").join(", ");
    const rows = await this.db.getAllAsync<ContentBlockRow>(
      `
SELECT *
FROM content_blocks
WHERE message_id IN (${placeholders})
ORDER BY message_id ASC, sequence ASC
`,
      messageIds
    );

    return rows.map(mapContentBlock);
  }
}

export function composeChatMessages(
  messages: Message[],
  blocks: ContentBlock[]
): ChatMessage[] {
  const blocksByMessageId = new Map<string, ContentBlock[]>();

  for (const block of blocks) {
    const group = blocksByMessageId.get(block.messageId) ?? [];
    group.push(block);
    blocksByMessageId.set(block.messageId, group);
  }

  return messages.map((message) => ({
    ...message,
    blocks: blocksByMessageId.get(message.id) ?? [],
  }));
}
