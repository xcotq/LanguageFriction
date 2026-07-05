import { jsonSchema } from "ai";

import type { KnowledgeRepository } from "@/data/repositories/knowledge.repository";
import {
    languageModelService,
    type LanguageModelService,
} from "@/services/llm/language-model-service";
import {
    INQUIRY_KNOWLEDGE_DRAFT_PROMPT_OPTIONS,
    createInquiryKnowledgeDraftPrompt,
} from "@/services/llm/prompts/session-extraction-prompts";
import type { Concept } from "@/types/domain";

import { segmentInquiries } from "./segment-inquiries";
import {
    createDeterministicId,
    normalizeLookupText,
    stableHash,
} from "./stable";
import {
    asRecord,
    asString,
    asStringArray,
    clampConfidence,
    compactRecord,
    isNonNullable,
} from "./structured-output-normalizers";
import { inferRecommendedUtterance } from "./transcript-heuristics";
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

type DraftKnowledgeOutput = InquiryKnowledgeDraft;

export type SessionExtractionWorkflowInput = {
    snapshot: TranscriptSnapshot;
    knowledgeRepository: KnowledgeRepository;
    useModel?: boolean;
    modelService?: LanguageModelService;
};

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

const draftKnowledgeSchema = jsonSchema<DraftKnowledgeOutput>({
    type: "object",
    properties: {
        inquiryTempId: { type: "string" },
        knowledgePoint: {
            type: "object",
            properties: {
                title: { type: "string" },
                objective: { type: "string" },
                contextSnapshot: {
                    type: "object",
                    properties: {
                        source: { type: ["string", "null"] },
                        domain: { type: ["string", "null"] },
                        scenario: { type: ["string", "null"] },
                        speakerRole: { type: ["string", "null"] },
                        listenerRole: { type: ["string", "null"] },
                        region: { type: ["string", "null"] },
                        register: { type: ["string", "null"] },
                        sourceLanguage: { type: ["string", "null"] },
                        targetLanguage: { type: ["string", "null"] },
                        note: { type: ["string", "null"] },
                    },
                    required: [
                        "source",
                        "domain",
                        "scenario",
                        "speakerRole",
                        "listenerRole",
                        "region",
                        "register",
                        "sourceLanguage",
                        "targetLanguage",
                        "note",
                    ],
                    additionalProperties: false,
                },
                explanation: { type: ["string", "null"] },
            },
            required: ["title", "objective", "contextSnapshot", "explanation"],
            additionalProperties: false,
        },
        utterances: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    text: { type: "string" },
                    language: { type: "string" },
                    role: { type: "string", enum: utteranceRoles },
                    usageNote: { type: ["string", "null"] },
                },
                required: ["text", "language", "role", "usageNote"],
                additionalProperties: false,
            },
        },
        conceptCandidates: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tempRef: { type: "string" },
                    canonicalLabel: { type: "string" },
                    languageHint: { type: ["string", "null"] },
                    definition: { type: ["string", "null"] },
                    domain: {
                        type: ["array", "null"],
                        items: { type: "string" },
                    },
                    aliases: {
                        type: ["array", "null"],
                        items: { type: "string" },
                    },
                    disambiguationNote: { type: ["string", "null"] },
                    role: { type: "string", enum: entityRoles },
                    evidence: { type: "array", items: { type: "string" } },
                },
                required: [
                    "tempRef",
                    "canonicalLabel",
                    "languageHint",
                    "definition",
                    "domain",
                    "aliases",
                    "disambiguationNote",
                    "role",
                    "evidence",
                ],
                additionalProperties: false,
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
                    partOfSpeech: { type: ["string", "null"] },
                    register: { type: ["string", "null"] },
                    region: { type: ["string", "null"] },
                    domain: {
                        type: ["array", "null"],
                        items: { type: "string" },
                    },
                    meaningNote: { type: ["string", "null"] },
                    usageNote: { type: ["string", "null"] },
                    role: { type: "string", enum: entityRoles },
                    evidence: { type: "array", items: { type: "string" } },
                },
                required: [
                    "tempRef",
                    "text",
                    "language",
                    "normalizedText",
                    "partOfSpeech",
                    "register",
                    "region",
                    "domain",
                    "meaningNote",
                    "usageNote",
                    "role",
                    "evidence",
                ],
                additionalProperties: false,
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
                    evidence: {
                        type: "object",
                        properties: {
                            summary: { type: ["string", "null"] },
                            sourceMessageIds: {
                                type: "array",
                                items: { type: "string" },
                            },
                            quote: { type: ["string", "null"] },
                            reason: { type: ["string", "null"] },
                        },
                        required: [
                            "summary",
                            "sourceMessageIds",
                            "quote",
                            "reason",
                        ],
                        additionalProperties: false,
                    },
                },
                required: [
                    "fromTempRef",
                    "toTempRef",
                    "type",
                    "direction",
                    "confidence",
                    "evidence",
                ],
                additionalProperties: false,
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
    additionalProperties: false,
});

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
        evidence: compactRecord(record.evidence),
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
            contextSnapshot: compactRecord(knowledgePoint.contextSnapshot),
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
