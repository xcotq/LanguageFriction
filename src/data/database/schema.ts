import {
    index,
    integer,
    primaryKey,
    real,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";

import type {
    ContentBlockType,
    InquiryCreatedFrom,
    InquiryMessageRole,
    InquiryStatus,
    KnowledgeEntityStatus,
    KnowledgePointEntityRole,
    KnowledgePointEntityType,
    KnowledgePointStatus,
    KnowledgePointUtteranceRole,
    LearningAbility,
    LearningDifficulty,
    LearningEvidenceResult,
    LearningTargetEntityRole,
    LearningTargetEntityType,
    LearningTargetStatus,
    MessageRole,
    PatternSource,
    PatternStatus,
    PracticeItemType,
    RelationDirection,
    RelationEntityType,
    RelationSource,
    RelationStatus,
    RelationType,
    SessionStatus,
} from "@/types/domain";

export const sessions = sqliteTable(
    "sessions",
    {
        id: text("id").primaryKey().notNull(),
        userId: text("user_id").notNull(),
        title: text("title"),
        startedAt: text("started_at").notNull(),
        endedAt: text("ended_at"),
        lastMessageAt: text("last_message_at").notNull(),
        status: text("status").notNull().$type<SessionStatus>(),
    },
    (table) => [
        index("idx_sessions_user_last_message").on(
            table.userId,
            table.lastMessageAt
        ),
        index("idx_sessions_user_started").on(table.userId, table.startedAt),
    ]
);

export const messages = sqliteTable(
    "messages",
    {
        id: text("id").primaryKey().notNull(),
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        role: text("role").notNull().$type<MessageRole>(),
        sequence: integer("sequence").notNull(),
        createdAt: text("created_at").notNull(),
    },
    (table) => [
        unique("uq_messages_session_sequence").on(
            table.sessionId,
            table.sequence
        ),
        index("idx_messages_session_sequence").on(
            table.sessionId,
            table.sequence
        ),
    ]
);

export const contentBlocks = sqliteTable(
    "content_blocks",
    {
        id: text("id").primaryKey().notNull(),
        messageId: text("message_id")
            .notNull()
            .references(() => messages.id, { onDelete: "cascade" }),
        type: text("type").notNull().$type<ContentBlockType>(),
        contentJson: text("content_json").notNull(),
        metadataJson: text("metadata_json"),
        sequence: integer("sequence").notNull(),
    },
    (table) => [
        unique("uq_content_blocks_message_sequence").on(
            table.messageId,
            table.sequence
        ),
        index("idx_content_blocks_message_sequence").on(
            table.messageId,
            table.sequence
        ),
    ]
);

export const inquiries = sqliteTable(
    "inquiries",
    {
        id: text("id").primaryKey().notNull(),
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        userNeed: text("user_need").notNull(),
        contextSummary: text("context_summary").notNull(),
        sourceLanguage: text("source_language"),
        targetLanguage: text("target_language").notNull(),
        status: text("status").notNull().$type<InquiryStatus>(),
        createdFrom: text("created_from").notNull().$type<InquiryCreatedFrom>(),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [index("idx_inquiries_session").on(table.sessionId)]
);

export const inquiryMessages = sqliteTable(
    "inquiry_messages",
    {
        inquiryId: text("inquiry_id")
            .notNull()
            .references(() => inquiries.id, { onDelete: "cascade" }),
        messageId: text("message_id")
            .notNull()
            .references(() => messages.id, { onDelete: "cascade" }),
        role: text("role").notNull().$type<InquiryMessageRole>(),
        sequence: integer("sequence"),
    },
    (table) => [
        primaryKey({
            columns: [table.inquiryId, table.messageId, table.role],
        }),
    ]
);

export const concepts = sqliteTable(
    "concepts",
    {
        id: text("id").primaryKey().notNull(),
        canonicalLabel: text("canonical_label").notNull(),
        languageHint: text("language_hint"),
        definition: text("definition"),
        domainJson: text("domain_json"),
        aliasesJson: text("aliases_json"),
        disambiguationNote: text("disambiguation_note"),
        status: text("status").notNull().$type<KnowledgeEntityStatus>(),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [index("idx_concepts_label").on(table.canonicalLabel)]
);

export const expressions = sqliteTable(
    "expressions",
    {
        id: text("id").primaryKey().notNull(),
        text: text("text").notNull(),
        language: text("language").notNull(),
        normalizedText: text("normalized_text").notNull(),
        partOfSpeech: text("part_of_speech"),
        register: text("register"),
        region: text("region"),
        domainJson: text("domain_json"),
        meaningNote: text("meaning_note"),
        usageNote: text("usage_note"),
        status: text("status").notNull().$type<KnowledgeEntityStatus>(),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        index("idx_expressions_lookup").on(
            table.language,
            table.normalizedText
        ),
    ]
);

export const patterns = sqliteTable(
    "patterns",
    {
        id: text("id").primaryKey().notNull(),
        template: text("template").notNull(),
        language: text("language").notNull(),
        slotsJson: text("slots_json").notNull(),
        explanation: text("explanation"),
        usageScope: text("usage_scope"),
        confidence: real("confidence").notNull(),
        source: text("source").notNull().$type<PatternSource>(),
        status: text("status").notNull().$type<PatternStatus>(),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        index("idx_patterns_language_status").on(table.language, table.status),
    ]
);

export const knowledgePoints = sqliteTable(
    "knowledge_points",
    {
        id: text("id").primaryKey().notNull(),
        inquiryId: text("inquiry_id")
            .notNull()
            .references(() => inquiries.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        objective: text("objective").notNull(),
        contextSnapshotJson: text("context_snapshot_json").notNull(),
        explanation: text("explanation"),
        status: text("status").notNull().$type<KnowledgePointStatus>(),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [index("idx_knowledge_points_inquiry").on(table.inquiryId)]
);

export const knowledgePointUtterances = sqliteTable(
    "knowledge_point_utterances",
    {
        id: text("id").primaryKey().notNull(),
        knowledgePointId: text("knowledge_point_id")
            .notNull()
            .references(() => knowledgePoints.id, { onDelete: "cascade" }),
        text: text("text").notNull(),
        language: text("language").notNull(),
        role: text("role").notNull().$type<KnowledgePointUtteranceRole>(),
        usageNote: text("usage_note"),
        createdAt: text("created_at").notNull(),
    },
    (table) => [index("idx_kp_utterances_kp").on(table.knowledgePointId)]
);

export const knowledgePointEntities = sqliteTable(
    "knowledge_point_entities",
    {
        knowledgePointId: text("knowledge_point_id")
            .notNull()
            .references(() => knowledgePoints.id, { onDelete: "cascade" }),
        entityType: text("entity_type")
            .notNull()
            .$type<KnowledgePointEntityType>(),
        entityId: text("entity_id").notNull(),
        role: text("role").notNull().$type<KnowledgePointEntityRole>(),
    },
    (table) => [
        primaryKey({
            columns: [
                table.knowledgePointId,
                table.entityType,
                table.entityId,
                table.role,
            ],
        }),
    ]
);

export const relations = sqliteTable(
    "relations",
    {
        id: text("id").primaryKey().notNull(),
        fromType: text("from_type").notNull().$type<RelationEntityType>(),
        fromId: text("from_id").notNull(),
        toType: text("to_type").notNull().$type<RelationEntityType>(),
        toId: text("to_id").notNull(),
        type: text("type").notNull().$type<RelationType>(),
        direction: text("direction").notNull().$type<RelationDirection>(),
        confidence: real("confidence").notNull(),
        source: text("source").notNull().$type<RelationSource>(),
        status: text("status").notNull().$type<RelationStatus>(),
        evidenceJson: text("evidence_json"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        index("idx_relations_from").on(table.fromType, table.fromId),
        index("idx_relations_to").on(table.toType, table.toId),
    ]
);

export const learningTargets = sqliteTable(
    "learning_targets",
    {
        id: text("id").primaryKey().notNull(),
        userId: text("user_id").notNull(),
        knowledgePointId: text("knowledge_point_id").references(
            () => knowledgePoints.id,
            { onDelete: "set null" }
        ),
        ability: text("ability").notNull().$type<LearningAbility>(),
        status: text("status").notNull().$type<LearningTargetStatus>(),
        priority: integer("priority").notNull(),
        difficulty: text("difficulty").$type<LearningDifficulty>(),
        stability: real("stability"),
        dueAt: text("due_at"),
        lastReviewedAt: text("last_reviewed_at"),
        reviewCount: integer("review_count").notNull(),
        lapseCount: integer("lapse_count").notNull(),
        schedulingAlgorithm: text("scheduling_algorithm"),
        schedulingVersion: text("scheduling_version"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        index("idx_learning_targets_user_due").on(
            table.userId,
            table.status,
            table.dueAt
        ),
    ]
);

export const learningTargetEntities = sqliteTable(
    "learning_target_entities",
    {
        learningTargetId: text("learning_target_id")
            .notNull()
            .references(() => learningTargets.id, { onDelete: "cascade" }),
        entityType: text("entity_type")
            .notNull()
            .$type<LearningTargetEntityType>(),
        entityId: text("entity_id").notNull(),
        role: text("role").notNull().$type<LearningTargetEntityRole>(),
    },
    (table) => [
        primaryKey({
            columns: [
                table.learningTargetId,
                table.entityType,
                table.entityId,
                table.role,
            ],
        }),
        index("idx_learning_target_entities_entity").on(
            table.entityType,
            table.entityId
        ),
    ]
);

export const practiceItems = sqliteTable("practice_items", {
    id: text("id").primaryKey().notNull(),
    type: text("type").notNull().$type<PracticeItemType>(),
    promptJson: text("prompt_json").notNull(),
    expectedAnswerJson: text("expected_answer_json"),
    acceptableAnswersJson: text("acceptable_answers_json"),
    contextSnapshotJson: text("context_snapshot_json"),
    generatedAt: text("generated_at").notNull(),
    expiresAt: text("expires_at"),
});

export const practiceItemTargets = sqliteTable(
    "practice_item_targets",
    {
        practiceItemId: text("practice_item_id")
            .notNull()
            .references(() => practiceItems.id, { onDelete: "cascade" }),
        learningTargetId: text("learning_target_id")
            .notNull()
            .references(() => learningTargets.id, { onDelete: "cascade" }),
        weight: real("weight").notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.practiceItemId, table.learningTargetId] }),
        index("idx_practice_item_targets_target").on(table.learningTargetId),
    ]
);

export const userResponses = sqliteTable(
    "user_responses",
    {
        id: text("id").primaryKey().notNull(),
        practiceItemId: text("practice_item_id")
            .notNull()
            .references(() => practiceItems.id, { onDelete: "cascade" }),
        userId: text("user_id").notNull(),
        answerJson: text("answer_json").notNull(),
        submittedAt: text("submitted_at").notNull(),
        feedbackJson: text("feedback_json"),
    },
    (table) => [index("idx_user_responses_practice").on(table.practiceItemId)]
);

export const learningEvidence = sqliteTable(
    "learning_evidence",
    {
        id: text("id").primaryKey().notNull(),
        userResponseId: text("user_response_id")
            .notNull()
            .references(() => userResponses.id, { onDelete: "cascade" }),
        learningTargetId: text("learning_target_id")
            .notNull()
            .references(() => learningTargets.id, { onDelete: "cascade" }),
        result: text("result").notNull().$type<LearningEvidenceResult>(),
        confidence: real("confidence"),
        errorJson: text("error_json"),
        createdAt: text("created_at").notNull(),
    },
    (table) => [
        index("idx_learning_evidence_target_created").on(
            table.learningTargetId,
            table.createdAt
        ),
    ]
);

export const appSettings = sqliteTable("app_settings", {
    key: text("key").primaryKey().notNull(),
    valueJson: text("value_json").notNull(),
    updatedAt: text("updated_at").notNull(),
});
