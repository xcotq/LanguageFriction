import type { ChatSession } from "@/types/domain";

export const mockSessions: ChatSession[] = [
  {
    id: "session-current",
    userId: "mock-user",
    title: "Restaurant wording",
    startedAt: new Date("2026-06-29T08:30:00+08:00"),
    lastMessageAt: new Date("2026-06-29T08:32:00+08:00"),
    status: "active",
    messages: [
      {
        id: "message-1",
        sessionId: "session-current",
        role: "user",
        sequence: 1,
        createdAt: new Date("2026-06-29T08:31:00+08:00"),
        blocks: [
          {
            id: "block-1",
            messageId: "message-1",
            type: "text",
            content:
              "吃饭的时候我想要额外的烤土豆上的培根碎，怎么自然表达？",
            sequence: 1,
          },
        ],
      },
      {
        id: "message-2",
        sessionId: "session-current",
        role: "assistant",
        sequence: 2,
        createdAt: new Date("2026-06-29T08:32:00+08:00"),
        blocks: [
          {
            id: "block-2",
            messageId: "message-2",
            type: "text",
            content: [
              "最自然的一句可以说：",
              "",
              "> Could I get extra bacon bits on my baked potato?",
              "",
              "**语气**：礼貌、轻松，适合在美国餐厅点餐。",
              "",
              "| 中文想法 | 英文表达 |",
              "| --- | --- |",
              "| 额外的 | extra |",
              "| 培根碎 | bacon bits |",
              "| 烤土豆上 | on my baked potato |",
              "",
              "也可以说：`Can I get extra bacon bits on that?`，如果前面已经点过 baked potato。",
            ].join("\n"),
            sequence: 1,
          },
        ],
      },
    ],
  },
  {
    id: "session-archived-1",
    userId: "mock-user",
    title: "Chamfer vs fillet",
    startedAt: new Date("2026-06-27T20:10:00+08:00"),
    endedAt: new Date("2026-06-27T20:25:00+08:00"),
    lastMessageAt: new Date("2026-06-27T20:10:00+08:00"),
    status: "closed",
    messages: [
      {
        id: "message-3",
        sessionId: "session-archived-1",
        role: "user",
        sequence: 1,
        createdAt: new Date("2026-06-27T20:10:00+08:00"),
        blocks: [
          {
            id: "block-3",
            messageId: "message-3",
            type: "text",
            content: "倒角和圆角在英文里怎么区分？",
            sequence: 1,
          },
        ],
      },
    ],
  },
  {
    id: "session-archived-2",
    userId: "mock-user",
    title: "Power outlet",
    startedAt: new Date("2026-06-24T10:15:00+08:00"),
    endedAt: new Date("2026-06-24T10:22:00+08:00"),
    lastMessageAt: new Date("2026-06-24T10:15:00+08:00"),
    status: "closed",
    messages: [
      {
        id: "message-4",
        sessionId: "session-archived-2",
        role: "user",
        sequence: 1,
        createdAt: new Date("2026-06-24T10:15:00+08:00"),
        blocks: [
          {
            id: "block-4",
            messageId: "message-4",
            type: "text",
            content: "我想问哪里有插座，英语怎么说？",
            sequence: 1,
          },
        ],
      },
    ],
  },
];
