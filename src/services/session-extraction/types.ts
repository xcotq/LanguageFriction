import type {
    InquiryMessageRole,
    KnowledgePointEntityRole,
    KnowledgePointUtteranceRole,
    MessageRole,
    RelationDirection,
    RelationType,
} from "@/types/domain";

export type TranscriptSnapshotMessage = {
    id: string;
    role: MessageRole;
    sequence: number;
    createdAt: string;
    text: string;
    nonTextBlocks: {
        type: "image" | "audio" | "diagram" | "structured";
        metadata?: Record<string, unknown>;
        sequence: number;
    }[];
};

export type TranscriptSnapshot = {
    sessionId: string;
    userId: string;
    title?: string;
    startedAt: string;
    endedAt?: string;
    transcriptHash: string;
    messages: TranscriptSnapshotMessage[];
};

export type InquirySlice = {
    tempId: string;
    title: string;
    userNeed: string;
    contextSummary: string;
    sourceLanguage?: string;
    targetLanguage: string;
    messageLinks: {
        messageId: string;
        role: InquiryMessageRole;
        sequence?: number;
    }[];
    confidence: number;
    reason: string;
};

export type EntityCandidateRole = Exclude<KnowledgePointEntityRole, "derived">;

export type ConceptCandidate = {
    tempRef: string;
    canonicalLabel: string;
    languageHint?: string;
    definition?: string;
    domain?: string[];
    aliases?: string[];
    disambiguationNote?: string;
    role: EntityCandidateRole;
    evidence: string[];
};

export type ExpressionCandidate = {
    tempRef: string;
    text: string;
    language: string;
    normalizedText: string;
    partOfSpeech?: string;
    register?: string;
    region?: string;
    domain?: string[];
    meaningNote?: string;
    usageNote?: string;
    role: EntityCandidateRole;
    evidence: string[];
};

export type MainFlowRelationType = Extract<
    RelationType,
    | "expresses"
    | "partially_expresses"
    | "ambiguous_with"
    | "used_with"
    | "part_of"
    | "is_a"
    | "contrast_with"
    | "confusable_with"
    | "variant_of"
    | "derived_from"
>;

export type RelationCandidate = {
    fromTempRef: string;
    toTempRef: string;
    type: MainFlowRelationType;
    direction: RelationDirection;
    confidence: number;
    evidence: Record<string, unknown>;
};

export type InquiryKnowledgeDraft = {
    inquiryTempId: string;
    knowledgePoint: {
        title: string;
        objective: string;
        contextSnapshot: Record<string, unknown>;
        explanation?: string;
    };
    utterances: {
        text: string;
        language: string;
        role: KnowledgePointUtteranceRole;
        usageNote?: string;
    }[];
    conceptCandidates: ConceptCandidate[];
    expressionCandidates: ExpressionCandidate[];
    relationCandidates: RelationCandidate[];
};

export type EntityResolutionPreview =
    | {
          tempRef: string;
          entityType: "concept";
          decision: "link_existing" | "create_new" | "ignore";
          existingEntityId?: string;
          displayLabel: string;
          role: EntityCandidateRole;
          confidence: number;
          reason: string;
          draft?: Omit<ConceptCandidate, "tempRef" | "role" | "evidence">;
      }
    | {
          tempRef: string;
          entityType: "expression";
          decision: "link_existing" | "create_new" | "ignore";
          existingEntityId?: string;
          displayLabel: string;
          role: EntityCandidateRole;
          confidence: number;
          reason: string;
          draft?: Omit<ExpressionCandidate, "tempRef" | "role" | "evidence">;
      };

export type InquiryExtractionPreview = {
    tempId: string;
    inquiry: Omit<InquirySlice, "tempId" | "confidence" | "reason">;
    knowledgePoint: InquiryKnowledgeDraft["knowledgePoint"];
    utterances: InquiryKnowledgeDraft["utterances"];
    entities: EntityResolutionPreview[];
    relations: {
        fromTempRef: string;
        toTempRef: string;
        type: RelationType;
        direction: RelationDirection;
        confidence: number;
        evidence: Record<string, unknown>;
    }[];
};

export type SessionExtractionPreview = {
    id: string;
    sessionId: string;
    userId: string;
    transcriptHash: string;
    generatedAt: string;
    inquiryPreviews: InquiryExtractionPreview[];
};
