import { jsonSchema } from "ai";

import type { KnowledgeRepository } from "@/data/repositories/knowledge.repository";
import {
    languageModelService,
    type LanguageModelService,
} from "@/services/llm/language-model-service";
import {
    INQUIRY_KNOWLEDGE_DRAFT_PROMPT_OPTIONS,
    SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS,
    createInquiryKnowledgeDraftPrompt,
    createSessionInquirySegmentationPrompt,
} from "@/services/llm/prompts/session-extraction-prompts";
import type { Concept, InquiryMessageRole } from "@/types/domain";

import {
    createDeterministicId,
    normalizeLookupText,
    stableHash,
    truncateText,
} from "./stable";
import type {
    ConceptCandidate,
    EntityCandidateRole,
    EntityResolutionPreview,
    ExpressionCandidate,
    InquiryExtractionPreview,
    InquiryKnowledgeDraft,
    InquirySlice,
    MainFlowRelationType,
    RelationCandidate,
    SessionExtractionPreview,
    TranscriptSnapshot,
} from "./types";

type SegmentInquiriesOutput = {
    inquiries: InquirySlice[];
};

type DraftKnowledgeOutput = InquiryKnowledgeDraft;

export type SessionExtractionWorkflowInput = {
    snapshot: TranscriptSnapshot;
    knowledgeRepository: KnowledgeRepository;
    useModel?: boolean;
    modelService?: LanguageModelService;
};

const inquiryMessageRoles: InquiryMessageRole[] = [
    "primary_question",
    "clarification",
    "answer",
    "correction",
    "supporting",
];

const entityRoles: EntityCandidateRole[] = [
    "primary",
    "supporting",
    "contrast",
    "context",
];

const utteranceRoles = [
    "recommended",
    "alternative",
    "contrast",
    "incorrect",
    "literal_translation",
] satisfies InquiryKnowledgeDraft["utterances"][number]["role"][];

const relationTypes: MainFlowRelationType[] = [
    "expresses",
    "partially_expresses",
    "ambiguous_with",
    "used_with",
    "part_of",
    "is_a",
    "contrast_with",
    "confusable_with",
    "variant_of",
    "derived_from",
];

const segmentInquiriesSchema = jsonSchema<SegmentInquiriesOutput>({
    type: "object",
    properties: {
        inquiries: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tempId: { type: "string" },
                    title: { type: "string" },
                    userNeed: { type: "string" },
                    contextSummary: { type: "string" },
                    sourceLanguage: { type: "string" },
                    targetLanguage: { type: "string" },
                    messageLinks: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                messageId: { type: "string" },
                                role: {
                                    type: "string",
                                    enum: inquiryMessageRoles,
                                },
                                sequence: { type: "number" },
                            },
                            required: ["messageId", "role"],
                        },
                    },
                    confidence: { type: "number" },
                    reason: { type: "string" },
                },
                required: [
                    "tempId",
                    "title",
                    "userNeed",
                    "contextSummary",
                    "targetLanguage",
                    "messageLinks",
                    "confidence",
                    "reason",
                ],
            },
        },
    },
    required: ["inquiries"],
});

const draftKnowledgeSchema = jsonSchema<DraftKnowledgeOutput>({
    type: "object",
    properties: {
        inquiryTempId: { type: "string" },
        knowledgePoint: {
            type: "object",
            properties: {
                title: { type: "string" },
                objective: { type: "string" },
                contextSnapshot: { type: "object" },
                explanation: { type: "string" },
            },
            required: ["title", "objective", "contextSnapshot"],
        },
        utterances: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    text: { type: "string" },
                    language: { type: "string" },
                    role: { type: "string", enum: utteranceRoles },
                    usageNote: { type: "string" },
                },
                required: ["text", "language", "role"],
            },
        },
        conceptCandidates: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tempRef: { type: "string" },
                    canonicalLabel: { type: "string" },
                    languageHint: { type: "string" },
                    definition: { type: "string" },
                    domain: { type: "array", items: { type: "string" } },
                    aliases: { type: "array", items: { type: "string" } },
                    disambiguationNote: { type: "string" },
                    role: { type: "string", enum: entityRoles },
                    evidence: { type: "array", items: { type: "string" } },
                },
                required: ["tempRef", "canonicalLabel", "role", "evidence"],
            },
        },
        expressionCandidates: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tempRef: { type: "string" },
                    text: { type: "string" },
                    language: { type: "string" },
                    normalizedText: { type: "string" },
                    partOfSpeech: { type: "string" },
                    register: { type: "string" },
                    region: { type: "string" },
                    domain: { type: "array", items: { type: "string" } },
                    meaningNote: { type: "string" },
                    usageNote: { type: "string" },
                    role: { type: "string", enum: entityRoles },
                    evidence: { type: "array", items: { type: "string" } },
                },
                required: [
                    "tempRef",
                    "text",
                    "language",
                    "normalizedText",
                    "role",
                    "evidence",
                ],
            },
        },
        relationCandidates: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    fromTempRef: { type: "string" },
                    toTempRef: { type: "string" },
                    type: { type: "string", enum: relationTypes },
                    direction: {
                        type: "string",
                        enum: ["directed", "undirected"],
                    },
                    confidence: { type: "number" },
                    evidence: { type: "object" },
                },
                required: [
                    "fromTempRef",
                    "toTempRef",
                    "type",
                    "direction",
                    "confidence",
                    "evidence",
                ],
            },
        },
    },
    required: [
        "inquiryTempId",
        "knowledgePoint",
        "utterances",
        "conceptCandidates",
        "expressionCandidates",
        "relationCandidates",
    ],
});

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function isNonNullable<T>(value: T | null | undefined): value is T {
    return value != null;
}

function asString(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

function clampConfidence(value: unknown, fallback = 0.7) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : fallback;
}

function firstUserMessage(snapshot: TranscriptSnapshot) {
    return snapshot.messages.find(
        (message) => message.role === "user" && message.text.trim()
    );
}

function assistantMessages(snapshot: TranscriptSnapshot) {
    return snapshot.messages.filter(
        (message) => message.role === "assistant" && message.text.trim()
    );
}

function includesCjk(text: string) {
    return /[\u3400-\u9fff]/.test(text);
}

function inferSourceLanguage(text: string) {
    return includesCjk(text) ? "zh-CN" : undefined;
}

function inferRecommendedUtterance(snapshot: TranscriptSnapshot) {
    const assistantText = assistantMessages(snapshot)
        .map((message) => message.text)
        .join("\n\n");
    const quoteMatch = assistantText.match(/^\s*>\s*(.+)$/m);
    const codeMatch = assistantText.match(/`([^`\n]{8,160})`/);

    return (quoteMatch?.[1] ?? codeMatch?.[1] ?? "").trim();
}

function createDefaultMessageLinks(
    snapshot: TranscriptSnapshot
): InquirySlice["messageLinks"] {
    const firstUser = firstUserMessage(snapshot);
    const firstAssistant = assistantMessages(snapshot)[0];
    const links: InquirySlice["messageLinks"] = [];

    if (firstUser) {
        links.push({
            messageId: firstUser.id,
            role: "primary_question",
            sequence: 1,
        });
    }

    if (firstAssistant) {
        links.push({
            messageId: firstAssistant.id,
            role: "answer",
            sequence: 2,
        });
    }

    return links;
}

function normalizeMessageLinks(
    value: unknown,
    snapshot: TranscriptSnapshot
): InquirySlice["messageLinks"] {
    const validMessageIds = new Set(
        snapshot.messages.map((message) => message.id)
    );

    const links = Array.isArray(value)
        ? value
              .map(
                  (
                      item,
                      index
                  ): InquirySlice["messageLinks"][number] | null => {
                      const record = asRecord(item);
                      const messageId = asString(record.messageId);
                      const role = asString(record.role) as InquiryMessageRole;

                      if (
                          !validMessageIds.has(messageId) ||
                          !inquiryMessageRoles.includes(role)
                      ) {
                          return null;
                      }

                      return {
                          messageId,
                          role,
                          sequence:
                              typeof record.sequence === "number"
                                  ? record.sequence
                                  : index + 1,
                      };
                  }
              )
              .filter(isNonNullable)
        : [];

    return links.length > 0 ? links : createDefaultMessageLinks(snapshot);
}

function normalizeInquirySlices(
    output: SegmentInquiriesOutput,
    snapshot: TranscriptSnapshot
): InquirySlice[] {
    const records = Array.isArray(output.inquiries) ? output.inquiries : [];

    return records
        .map((rawSlice, index): InquirySlice | null => {
            const record = asRecord(rawSlice);
            const userNeed = asString(record.userNeed);

            if (!userNeed) {
                return null;
            }

            const title = asString(
                record.title,
                truncateText(userNeed, 64) || "Language friction inquiry"
            );

            return {
                tempId: asString(
                    record.tempId,
                    createDeterministicId("inq", {
                        sessionId: snapshot.sessionId,
                        transcriptHash: snapshot.transcriptHash,
                        index,
                    })
                ),
                title,
                userNeed,
                contextSummary: asString(
                    record.contextSummary,
                    "Concrete expression question from the session."
                ),
                sourceLanguage: asString(record.sourceLanguage) || undefined,
                targetLanguage: asString(record.targetLanguage, "en"),
                messageLinks: normalizeMessageLinks(
                    record.messageLinks,
                    snapshot
                ),
                confidence: clampConfidence(record.confidence),
                reason: asString(record.reason, "Structured extraction."),
            };
        })
        .filter(isNonNullable)
        .slice(0, 6);
}

function createHeuristicSlices(snapshot: TranscriptSnapshot): InquirySlice[] {
    const userMessage = firstUserMessage(snapshot);

    if (!userMessage) {
        return [];
    }

    const recommendedUtterance = inferRecommendedUtterance(snapshot);
    const title = recommendedUtterance
        ? `Learn: ${truncateText(recommendedUtterance, 58)}`
        : truncateText(userMessage.text, 58);

    return [
        {
            tempId: createDeterministicId("inq", {
                sessionId: snapshot.sessionId,
                messageId: userMessage.id,
                text: userMessage.text,
            }),
            title: title || "Language friction inquiry",
            userNeed: userMessage.text,
            contextSummary:
                "User asked a concrete expression question during this session.",
            sourceLanguage: inferSourceLanguage(userMessage.text),
            targetLanguage: "en",
            messageLinks: createDefaultMessageLinks(snapshot),
            confidence: 0.62,
            reason: "Local fallback segmentation for mock mode.",
        },
    ];
}

async function segmentInquiries(
    snapshot: TranscriptSnapshot,
    modelService: LanguageModelService,
    useModel: boolean
) {
    if (!useModel) {
        return createHeuristicSlices(snapshot);
    }

    const output = await modelService.structuredOutput({
        schema: segmentInquiriesSchema,
        options: SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS,
        input: createSessionInquirySegmentationPrompt(snapshot),
    });

    return normalizeInquirySlices(output, snapshot);
}

function normalizeCandidateRole(value: unknown): EntityCandidateRole {
    const role = asString(value) as EntityCandidateRole;
    return entityRoles.includes(role) ? role : "supporting";
}

function uniqueTempRef(
    preferredRef: string,
    fallbackSeed: unknown,
    usedRefs: Set<string>
) {
    let tempRef = preferredRef || createDeterministicId("entity", fallbackSeed);
    let suffix = 2;

    while (usedRefs.has(tempRef)) {
        tempRef = `${preferredRef || "entity"}:${suffix}`;
        suffix += 1;
    }

    usedRefs.add(tempRef);
    return tempRef;
}

function normalizeConceptCandidate(
    value: unknown,
    index: number,
    usedRefs: Set<string>
): ConceptCandidate | null {
    const record = asRecord(value);
    const canonicalLabel = asString(record.canonicalLabel);

    if (!canonicalLabel) {
        return null;
    }

    return {
        tempRef: uniqueTempRef(
            asString(record.tempRef),
            {
                type: "concept",
                canonicalLabel,
                index,
            },
            usedRefs
        ),
        canonicalLabel,
        languageHint: asString(record.languageHint) || undefined,
        definition: asString(record.definition) || undefined,
        domain: asStringArray(record.domain),
        aliases: asStringArray(record.aliases),
        disambiguationNote: asString(record.disambiguationNote) || undefined,
        role: normalizeCandidateRole(record.role),
        evidence: asStringArray(record.evidence),
    };
}

function normalizeExpressionCandidate(
    value: unknown,
    index: number,
    usedRefs: Set<string>
): ExpressionCandidate | null {
    const record = asRecord(value);
    const text = asString(record.text);
    const language = asString(record.language, "en");

    if (!text || !language) {
        return null;
    }

    return {
        tempRef: uniqueTempRef(
            asString(record.tempRef),
            {
                type: "expression",
                text,
                language,
                index,
            },
            usedRefs
        ),
        text,
        language,
        normalizedText: asString(
            record.normalizedText,
            normalizeLookupText(text)
        ),
        partOfSpeech: asString(record.partOfSpeech) || undefined,
        register: asString(record.register) || undefined,
        region: asString(record.region) || undefined,
        domain: asStringArray(record.domain),
        meaningNote: asString(record.meaningNote) || undefined,
        usageNote: asString(record.usageNote) || undefined,
        role: normalizeCandidateRole(record.role),
        evidence: asStringArray(record.evidence),
    };
}

function normalizeRelationCandidate(value: unknown): RelationCandidate | null {
    const record = asRecord(value);
    const type = asString(record.type) as MainFlowRelationType;
    const direction = asString(record.direction);

    if (
        !relationTypes.includes(type) ||
        (direction !== "directed" && direction !== "undirected")
    ) {
        return null;
    }

    const fromTempRef = asString(record.fromTempRef);
    const toTempRef = asString(record.toTempRef);

    if (!fromTempRef || !toTempRef || fromTempRef === toTempRef) {
        return null;
    }

    return {
        fromTempRef,
        toTempRef,
        type,
        direction,
        confidence: clampConfidence(record.confidence),
        evidence: asRecord(record.evidence),
    };
}

function normalizeKnowledgeDraft(
    output: DraftKnowledgeOutput,
    inquiry: InquirySlice
): InquiryKnowledgeDraft {
    const record = asRecord(output);
    const knowledgePoint = asRecord(record.knowledgePoint);
    const usedRefs = new Set<string>();
    const utterances = Array.isArray(record.utterances)
        ? record.utterances
              .map(
                  (
                      value
                  ): InquiryKnowledgeDraft["utterances"][number] | null => {
                      const utterance = asRecord(value);
                      const role = asString(utterance.role);
                      const text = asString(utterance.text);

                      if (
                          !text ||
                          !utteranceRoles.includes(
                              role as (typeof utteranceRoles)[number]
                          )
                      ) {
                          return null;
                      }

                      return {
                          text,
                          language: asString(
                              utterance.language,
                              inquiry.targetLanguage
                          ),
                          role: role as (typeof utteranceRoles)[number],
                          usageNote: asString(utterance.usageNote) || undefined,
                      };
                  }
              )
              .filter(isNonNullable)
        : [];

    return {
        inquiryTempId: asString(record.inquiryTempId, inquiry.tempId),
        knowledgePoint: {
            title: asString(knowledgePoint.title, inquiry.title),
            objective: asString(knowledgePoint.objective, inquiry.userNeed),
            contextSnapshot: asRecord(knowledgePoint.contextSnapshot),
            explanation: asString(knowledgePoint.explanation) || undefined,
        },
        utterances,
        conceptCandidates: Array.isArray(record.conceptCandidates)
            ? record.conceptCandidates
                  .map((value, index) =>
                      normalizeConceptCandidate(value, index, usedRefs)
                  )
                  .filter(isNonNullable)
            : [],
        expressionCandidates: Array.isArray(record.expressionCandidates)
            ? record.expressionCandidates
                  .map((value, index) =>
                      normalizeExpressionCandidate(value, index, usedRefs)
                  )
                  .filter(isNonNullable)
            : [],
        relationCandidates: Array.isArray(record.relationCandidates)
            ? record.relationCandidates
                  .map(normalizeRelationCandidate)
                  .filter(isNonNullable)
            : [],
    };
}

function createHeuristicDraft(
    snapshot: TranscriptSnapshot,
    inquiry: InquirySlice
): InquiryKnowledgeDraft {
    const utterance = inferRecommendedUtterance(snapshot);
    const expressionCandidates = utterance
        ? [
              {
                  tempRef: "expr:recommended",
                  text: utterance,
                  language: inquiry.targetLanguage,
                  normalizedText: normalizeLookupText(utterance),
                  register: "polite-casual",
                  meaningNote:
                      "Recommended wording extracted from the assistant answer.",
                  usageNote:
                      "Generated by local fallback; review before saving as reusable expression.",
                  role: "primary" as const,
                  evidence: [utterance],
              },
          ]
        : [];

    return {
        inquiryTempId: inquiry.tempId,
        knowledgePoint: {
            title: inquiry.title,
            objective: inquiry.userNeed,
            contextSnapshot: {
                source: "local_fallback",
                targetLanguage: inquiry.targetLanguage,
            },
            explanation:
                "Preview generated locally because model extraction is unavailable.",
        },
        utterances: utterance
            ? [
                  {
                      text: utterance,
                      language: inquiry.targetLanguage,
                      role: "recommended",
                      usageNote: "Recommended wording from the session answer.",
                  },
              ]
            : [],
        conceptCandidates: [],
        expressionCandidates,
        relationCandidates: [],
    };
}

async function draftKnowledgeForInquiry(
    snapshot: TranscriptSnapshot,
    inquiry: InquirySlice,
    modelService: LanguageModelService,
    useModel: boolean
) {
    if (!useModel) {
        return createHeuristicDraft(snapshot, inquiry);
    }

    const output = await modelService.structuredOutput({
        schema: draftKnowledgeSchema,
        options: INQUIRY_KNOWLEDGE_DRAFT_PROMPT_OPTIONS,
        input: createInquiryKnowledgeDraftPrompt({ snapshot, inquiry }),
    });

    return normalizeKnowledgeDraft(output, inquiry);
}

function shouldCreateEntity(role: EntityCandidateRole) {
    return role === "primary" || role === "contrast" || role === "supporting";
}

function conceptLabels(candidate: ConceptCandidate) {
    return [candidate.canonicalLabel, ...(candidate.aliases ?? [])].filter(
        Boolean
    );
}

function hasDomainOverlap(
    candidateDomain: string[] | undefined,
    entityDomain: string[] | undefined
) {
    if (!candidateDomain?.length || !entityDomain?.length) {
        return false;
    }

    const candidateValues = new Set(candidateDomain.map(normalizeLookupText));
    return entityDomain.some((domain) =>
        candidateValues.has(normalizeLookupText(domain))
    );
}

function chooseConceptMatch(candidate: ConceptCandidate, matches: Concept[]) {
    const labels = new Set(conceptLabels(candidate).map(normalizeLookupText));

    return (
        matches.find((match) =>
            labels.has(normalizeLookupText(match.canonicalLabel))
        ) ??
        matches.find((match) =>
            (match.aliases ?? []).some((alias) =>
                labels.has(normalizeLookupText(alias))
            )
        ) ??
        matches.find((match) =>
            hasDomainOverlap(candidate.domain, match.domain)
        ) ??
        matches[0]
    );
}

async function resolveConcept(
    candidate: ConceptCandidate,
    repository: KnowledgeRepository
): Promise<EntityResolutionPreview> {
    const matches = await repository.findConcepts(conceptLabels(candidate), 20);
    const match = chooseConceptMatch(candidate, matches);

    if (match) {
        return {
            tempRef: candidate.tempRef,
            entityType: "concept",
            decision: "link_existing",
            existingEntityId: match.id,
            displayLabel: match.canonicalLabel,
            role: candidate.role,
            confidence: 0.88,
            reason: "Matched an existing concept by label or alias.",
        };
    }

    if (!shouldCreateEntity(candidate.role)) {
        return {
            tempRef: candidate.tempRef,
            entityType: "concept",
            decision: "ignore",
            displayLabel: candidate.canonicalLabel,
            role: candidate.role,
            confidence: 0.7,
            reason: "Context-only concept is not promoted in the main flow.",
        };
    }

    return {
        tempRef: candidate.tempRef,
        entityType: "concept",
        decision: "create_new",
        displayLabel: candidate.canonicalLabel,
        role: candidate.role,
        confidence: 0.74,
        reason: "No matching concept found; candidate is useful for retrieval.",
        draft: {
            canonicalLabel: candidate.canonicalLabel,
            languageHint: candidate.languageHint,
            definition: candidate.definition,
            domain: candidate.domain,
            aliases: candidate.aliases,
            disambiguationNote: candidate.disambiguationNote,
        },
    };
}

async function resolveExpression(
    candidate: ExpressionCandidate,
    repository: KnowledgeRepository
): Promise<EntityResolutionPreview> {
    const matches = await repository.findExpressions(
        candidate.language,
        candidate.normalizedText,
        1
    );
    const match = matches[0];

    if (match) {
        return {
            tempRef: candidate.tempRef,
            entityType: "expression",
            decision: "link_existing",
            existingEntityId: match.id,
            displayLabel: match.text,
            role: candidate.role,
            confidence: 0.92,
            reason: "Matched an existing expression by language and normalized text.",
        };
    }

    if (!shouldCreateEntity(candidate.role)) {
        return {
            tempRef: candidate.tempRef,
            entityType: "expression",
            decision: "ignore",
            displayLabel: candidate.text,
            role: candidate.role,
            confidence: 0.7,
            reason: "Context-only expression is not promoted in the main flow.",
        };
    }

    return {
        tempRef: candidate.tempRef,
        entityType: "expression",
        decision: "create_new",
        displayLabel: candidate.text,
        role: candidate.role,
        confidence: 0.78,
        reason: "No exact expression match found.",
        draft: {
            text: candidate.text,
            language: candidate.language,
            normalizedText: candidate.normalizedText,
            partOfSpeech: candidate.partOfSpeech,
            register: candidate.register,
            region: candidate.region,
            domain: candidate.domain,
            meaningNote: candidate.meaningNote,
            usageNote: candidate.usageNote,
        },
    };
}

async function resolveEntities(
    draft: InquiryKnowledgeDraft,
    repository: KnowledgeRepository
) {
    const resolutions: EntityResolutionPreview[] = [];

    for (const candidate of draft.conceptCandidates) {
        resolutions.push(await resolveConcept(candidate, repository));
    }

    for (const candidate of draft.expressionCandidates) {
        resolutions.push(await resolveExpression(candidate, repository));
    }

    return resolutions;
}

function allowedRelation(
    fromType: "concept" | "expression",
    toType: "concept" | "expression",
    type: MainFlowRelationType
) {
    if (
        fromType === "expression" &&
        toType === "concept" &&
        ["expresses", "partially_expresses", "ambiguous_with"].includes(type)
    ) {
        return true;
    }

    if (
        fromType === "concept" &&
        toType === "concept" &&
        [
            "used_with",
            "part_of",
            "is_a",
            "contrast_with",
            "confusable_with",
        ].includes(type)
    ) {
        return true;
    }

    return (
        fromType === "expression" &&
        toType === "expression" &&
        ["variant_of", "contrast_with", "confusable_with"].includes(type)
    );
}

function filterRelations(
    draft: InquiryKnowledgeDraft,
    resolutions: EntityResolutionPreview[]
): InquiryExtractionPreview["relations"] {
    const resolutionByRef = new Map(
        resolutions
            .filter((resolution) => resolution.decision !== "ignore")
            .map((resolution) => [resolution.tempRef, resolution])
    );

    return draft.relationCandidates
        .filter((candidate) => {
            const from = resolutionByRef.get(candidate.fromTempRef);
            const to = resolutionByRef.get(candidate.toTempRef);

            return (
                Boolean(from) &&
                Boolean(to) &&
                allowedRelation(
                    from!.entityType,
                    to!.entityType,
                    candidate.type
                )
            );
        })
        .map((candidate) => ({
            fromTempRef: candidate.fromTempRef,
            toTempRef: candidate.toTempRef,
            type: candidate.type,
            direction: candidate.direction,
            confidence: candidate.confidence,
            evidence: candidate.evidence,
        }));
}

function ensureKnowledgePointContext(
    draft: InquiryKnowledgeDraft,
    inquiry: InquirySlice
) {
    return {
        targetLanguage: inquiry.targetLanguage,
        sourceLanguage: inquiry.sourceLanguage,
        ...draft.knowledgePoint.contextSnapshot,
    };
}

function assembleInquiryPreview(
    inquiry: InquirySlice,
    draft: InquiryKnowledgeDraft,
    entities: EntityResolutionPreview[]
): InquiryExtractionPreview {
    return {
        tempId: inquiry.tempId,
        inquiry: {
            title: inquiry.title,
            userNeed: inquiry.userNeed,
            contextSummary: inquiry.contextSummary,
            sourceLanguage: inquiry.sourceLanguage,
            targetLanguage: inquiry.targetLanguage,
            messageLinks: inquiry.messageLinks,
        },
        knowledgePoint: {
            ...draft.knowledgePoint,
            contextSnapshot: ensureKnowledgePointContext(draft, inquiry),
        },
        utterances: draft.utterances,
        entities,
        relations: filterRelations(draft, entities),
    };
}

export async function runSessionExtractionWorkflow({
    snapshot,
    knowledgeRepository,
    useModel = true,
    modelService = languageModelService,
}: SessionExtractionWorkflowInput): Promise<SessionExtractionPreview> {
    const inquirySlices = await segmentInquiries(
        snapshot,
        modelService,
        useModel
    );
    const inquiryPreviews: InquiryExtractionPreview[] = [];

    for (const inquiry of inquirySlices) {
        const draft = await draftKnowledgeForInquiry(
            snapshot,
            inquiry,
            modelService,
            useModel
        );
        const entities = await resolveEntities(draft, knowledgeRepository);
        inquiryPreviews.push(assembleInquiryPreview(inquiry, draft, entities));
    }

    return {
        id: `preview:${snapshot.sessionId}:${snapshot.transcriptHash}`,
        sessionId: snapshot.sessionId,
        userId: snapshot.userId,
        transcriptHash: snapshot.transcriptHash,
        generatedAt: new Date().toISOString(),
        inquiryPreviews,
    };
}

export function previewFingerprint(preview: SessionExtractionPreview) {
    return stableHash({
        sessionId: preview.sessionId,
        transcriptHash: preview.transcriptHash,
        inquiryIds: preview.inquiryPreviews.map((inquiry) => inquiry.tempId),
    });
}
