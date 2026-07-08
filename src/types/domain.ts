export type SessionStatus = "active" | "closed" | "archived";

export type MessageRole = "user" | "assistant" | "system";

export type ContentBlockType =
    "text" | "image" | "audio" | "diagram" | "structured";

export type Session = {
    id: string;
    userId: string;
    title?: string;
    startedAt: Date;
    endedAt?: Date;
    lastMessageAt: Date;
    status: SessionStatus;
};

export type Message = {
    id: string;
    sessionId: string;
    role: MessageRole;
    sequence: number;
    createdAt: Date;
};

export type ContentBlock = {
    id: string;
    messageId: string;
    type: ContentBlockType;
    content: unknown;
    metadata?: Record<string, unknown>;
    sequence: number;
};

export type ChatMessage = Message & {
    blocks: ContentBlock[];
};

export type ChatSession = Session & {
    messages: ChatMessage[];
};

export type InquiryStatus = "draft" | "extracted" | "archived";

export type InquiryCreatedFrom =
    "auto_summary" | "manual_save" | "system_suggested";

export type InquiryMessageRole =
    | "primary_question"
    | "clarification"
    | "answer"
    | "correction"
    | "supporting";

export type KnowledgeEntityStatus = "active" | "merged" | "archived";

export type PatternSource = "offline_induction" | "manual" | "system_suggested";

export type PatternStatus = "candidate" | "active" | "rejected" | "archived";

export type KnowledgePointStatus = "active" | "archived";

export type KnowledgePointUtteranceRole =
    | "recommended"
    | "alternative"
    | "contrast"
    | "incorrect"
    | "literal_translation";

export type KnowledgePointEntityType = "concept" | "expression" | "pattern";

export type KnowledgePointEntityRole =
    "primary" | "supporting" | "contrast" | "context" | "derived";

export type RelationEntityType =
    "concept" | "expression" | "pattern" | "knowledge_point";

export type RelationDirection = "directed" | "undirected";

export type RelationSource = "user" | "system" | "inquiry" | "offline";

export type RelationStatus = "suggested" | "confirmed" | "rejected";

export type RelationType =
    | "expresses"
    | "partially_expresses"
    | "ambiguous_with"
    | "used_with"
    | "part_of"
    | "is_a"
    | "contrast_with"
    | "confusable_with"
    | "variant_of"
    | "instantiates"
    | "derived_from"
    | "follow_up"
    | "refines"
    | "similar_learning_case"
    | "related_in_context";

export type LearningAbility =
    | "recognition"
    | "recall"
    | "contextual_production"
    | "transfer"
    | "distinction";

export type LearningDifficulty = "low" | "medium" | "high";

export type LearningTargetStatus =
    "active" | "paused" | "mastered" | "archived";

export type LearningTargetEntityType =
    "concept" | "expression" | "pattern" | "utterance";

export type LearningTargetEntityRole =
    "primary" | "prompt" | "required" | "contrast" | "supporting";

export type PracticeItemType =
    | "flashcard"
    | "free_response"
    | "translation"
    | "scenario_response"
    | "multiple_choice"
    | "correction";

export type LearningEvidenceResult =
    "correct" | "partial" | "failed" | "hinted" | "exposed" | "not_tested";

export type PatternSlot = {
    name: string;
    constraint?: string;
    examples?: string[];
};

export type Inquiry = {
    id: string;
    sessionId: string;
    title: string;
    userNeed: string;
    contextSummary: string;
    primaryLanguageContext: string;
    sourceLanguage?: string;
    targetLanguage: string;
    status: InquiryStatus;
    createdFrom: InquiryCreatedFrom;
    createdAt: Date;
    updatedAt: Date;
};

export type InquiryMessage = {
    inquiryId: string;
    messageId: string;
    role: InquiryMessageRole;
    sequence?: number;
};

export type Concept = {
    id: string;
    canonicalLabel: string;
    languageHint?: string;
    definition?: string;
    domain?: string[];
    aliases?: string[];
    disambiguationNote?: string;
    status: KnowledgeEntityStatus;
    createdAt: Date;
    updatedAt: Date;
};

export type Expression = {
    id: string;
    text: string;
    language: string;
    normalizedText: string;
    partOfSpeech?: string;
    register?: string;
    region?: string;
    domain?: string[];
    meaningNote?: string;
    usageNote?: string;
    status: KnowledgeEntityStatus;
    createdAt: Date;
    updatedAt: Date;
};

export type Pattern = {
    id: string;
    template: string;
    language: string;
    slots: PatternSlot[];
    explanation?: string;
    usageScope?: string;
    confidence: number;
    source: PatternSource;
    status: PatternStatus;
    createdAt: Date;
    updatedAt: Date;
};

export type KnowledgePoint = {
    id: string;
    inquiryId: string;
    title: string;
    objective: string;
    contextSnapshot: Record<string, unknown>;
    explanation?: string;
    status: KnowledgePointStatus;
    createdAt: Date;
    updatedAt: Date;
};

export type KnowledgePointUtterance = {
    id: string;
    knowledgePointId: string;
    text: string;
    language: string;
    role: KnowledgePointUtteranceRole;
    usageNote?: string;
    createdAt: Date;
};

export type KnowledgePointEntity = {
    knowledgePointId: string;
    entityType: KnowledgePointEntityType;
    entityId: string;
    role: KnowledgePointEntityRole;
};

export type Relation = {
    id: string;
    fromType: RelationEntityType;
    fromId: string;
    toType: RelationEntityType;
    toId: string;
    type: RelationType;
    direction: RelationDirection;
    confidence: number;
    source: RelationSource;
    status: RelationStatus;
    evidence?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
};

export type LearningTarget = {
    id: string;
    userId: string;
    knowledgePointId?: string;
    ability: LearningAbility;
    status: LearningTargetStatus;
    priority: number;
    difficulty?: LearningDifficulty;
    stability?: number;
    dueAt?: Date;
    lastReviewedAt?: Date;
    reviewCount: number;
    lapseCount: number;
    schedulingAlgorithm?: string;
    schedulingVersion?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type LearningTargetEntity = {
    learningTargetId: string;
    entityType: LearningTargetEntityType;
    entityId: string;
    role: LearningTargetEntityRole;
};

export type PracticeItem = {
    id: string;
    type: PracticeItemType;
    prompt: unknown;
    expectedAnswer?: unknown;
    acceptableAnswers?: unknown;
    contextSnapshot?: Record<string, unknown>;
    generatedAt: Date;
    expiresAt?: Date;
};

export type PracticeItemTarget = {
    practiceItemId: string;
    learningTargetId: string;
    weight: number;
};

export type UserResponse = {
    id: string;
    practiceItemId: string;
    userId: string;
    answer: unknown;
    submittedAt: Date;
    feedback?: unknown;
};

export type LearningEvidence = {
    id: string;
    userResponseId: string;
    learningTargetId: string;
    result: LearningEvidenceResult;
    confidence?: number;
    error?: unknown;
    createdAt: Date;
};
