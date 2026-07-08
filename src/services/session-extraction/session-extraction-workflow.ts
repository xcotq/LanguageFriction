import { jsonSchema } from "ai";

import {
    DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    type LanguagePreferenceSettings,
} from "@/constants/language-preferences";
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
    languagePreferences?: LanguagePreferenceSettings;
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
    description:
        "Reusable language knowledge drafted from one extracted Inquiry.",
    properties: {
        inquiryTempId: {
            type: "string",
            description:
                "Temporary ID of the source inquiry. Must exactly match the inquiry.tempId provided in the prompt.",
        },
        knowledgePoint: {
            type: "object",
            description:
                "The user-specific learning result created from this inquiry.",
            properties: {
                title: {
                    type: "string",
                    description:
                        "Short human-readable title for the learning point, focused on what the learner can now express or distinguish.",
                },
                objective: {
                    type: "string",
                    description:
                        "Concrete learning objective in the learner's context, such as producing a phrase naturally or distinguishing two meanings.",
                },
                contextSnapshot: {
                    type: "object",
                    description:
                        "Stable context needed to reuse, review, or practice this knowledge point later.",
                    properties: {
                        source: {
                            type: ["string", "null"],
                            description:
                                "Origin of the draft, usually the source inquiry or transcript context; use null when there is no concise source label.",
                        },
                        domain: {
                            type: ["string", "null"],
                            description:
                                "Lightweight usage domain such as restaurant, engineering, document, travel, daily_life, or null when unclear.",
                        },
                        scenario: {
                            type: ["string", "null"],
                            description:
                                "Situation where the expression is used, including practical task or setting when known.",
                        },
                        speakerRole: {
                            type: ["string", "null"],
                            description:
                                "Role of the person producing the target language, such as customer, applicant, engineer, or null when not stated.",
                        },
                        listenerRole: {
                            type: ["string", "null"],
                            description:
                                "Role of the expected listener or reader, such as server, interviewer, colleague, or null when not stated.",
                        },
                        region: {
                            type: ["string", "null"],
                            description:
                                "Regional variety relevant to the answer, such as US, UK, mainland China context, or null when not relevant.",
                        },
                        register: {
                            type: ["string", "null"],
                            description:
                                "Style or formality level such as polite-casual, formal, technical, colloquial, or null when not clear.",
                        },
                        sourceLanguage: {
                            type: ["string", "null"],
                            description:
                                "Language the learner starts from or uses to describe the need, if identifiable.",
                        },
                        targetLanguage: {
                            type: ["string", "null"],
                            description:
                                "Language the learner wants to produce or understand, if identifiable.",
                        },
                        note: {
                            type: ["string", "null"],
                            description:
                                "Any compact extra context that is important for future extraction or practice but does not fit the other fields.",
                        },
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
                explanation: {
                    type: ["string", "null"],
                    description:
                        "Brief reusable explanation of the answer, distinction, or usage constraint; use null when the utterances and entities are enough.",
                },
            },
            required: ["title", "objective", "contextSnapshot", "explanation"],
            additionalProperties: false,
        },
        utterances: {
            type: "array",
            description:
                "Complete sentence-level target-language answers or examples that belong to the KnowledgePoint.",
            items: {
                type: "object",
                description:
                    "One complete target-language wording used in this specific learning context.",
                properties: {
                    text: {
                        type: "string",
                        description:
                            "Complete utterance text in the inquiry target language, not just an isolated vocabulary item unless the inquiry truly asks only for a term.",
                    },
                    language: {
                        type: "string",
                        description:
                            "Target language of the utterance, preferably a BCP-47 code when known. This should match the inquiry targetLanguage.",
                    },
                    role: {
                        type: "string",
                        enum: utteranceRoles,
                        description:
                            "How this target-language utterance should be used in the KnowledgePoint, such as recommended, alternative, contrast, incorrect, or literal_translation.",
                    },
                    usageNote: {
                        type: ["string", "null"],
                        description:
                            "Short note about when this wording is natural, why it contrasts with another option, or why it is incorrect.",
                    },
                },
                required: ["text", "language", "role", "usageNote"],
                additionalProperties: false,
            },
        },
        conceptCandidates: {
            type: "array",
            description:
                "Stable meanings or real-world ideas that are primary, useful for retrieval, or needed to explain the inquiry.",
            items: {
                type: "object",
                description:
                    "A candidate Concept to create or link during entity resolution.",
                properties: {
                    tempRef: {
                        type: "string",
                        description:
                            "Unique temporary reference for this candidate within the draft, used by relationCandidates.",
                    },
                    canonicalLabel: {
                        type: "string",
                        description:
                            "Canonical label for the underlying concept, not necessarily the target-language expression.",
                    },
                    languageHint: {
                        type: ["string", "null"],
                        description:
                            "Language of the canonical label or primary learner wording when relevant; use null when language is not important.",
                    },
                    definition: {
                        type: ["string", "null"],
                        description:
                            "Concise meaning definition grounded in the inquiry context; use null if the label is self-explanatory.",
                    },
                    domain: {
                        type: ["array", "null"],
                        description:
                            "Lightweight domains for retrieval, such as food, restaurant, engineering, document, or null when unclear.",
                        items: { type: "string" },
                    },
                    aliases: {
                        type: ["array", "null"],
                        description:
                            "Alternative labels, source-language names, or common equivalent names for the same concept.",
                        items: { type: "string" },
                    },
                    disambiguationNote: {
                        type: ["string", "null"],
                        description:
                            "Note that distinguishes this concept from a nearby or confusable meaning; use null when not needed.",
                    },
                    role: {
                        type: "string",
                        enum: entityRoles,
                        description:
                            "Role of this concept in the KnowledgePoint: primary learning target, supporting context, contrast, or context.",
                    },
                    evidence: {
                        type: "array",
                        description:
                            "Short transcript-grounded reasons or quotes showing why this concept matters for the inquiry.",
                        items: { type: "string" },
                    },
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
            description:
                "Reusable words, phrases, collocations, or short expressions in a specific language and usage context.",
            items: {
                type: "object",
                description:
                    "A candidate Expression to create or link during entity resolution.",
                properties: {
                    tempRef: {
                        type: "string",
                        description:
                            "Unique temporary reference for this expression within the draft, used by relationCandidates.",
                    },
                    text: {
                        type: "string",
                        description:
                            "Display text of the expression as it should appear to the learner.",
                    },
                    language: {
                        type: "string",
                        description:
                            "Language of the expression, preferably a BCP-47 code when known.",
                    },
                    normalizedText: {
                        type: "string",
                        description:
                            "Lookup form for matching and deduplication, usually lowercase and trimmed while preserving meaning.",
                    },
                    partOfSpeech: {
                        type: ["string", "null"],
                        description:
                            "Part of speech for word-level expressions; use null for phrases, full requests, or cases where it would be misleading.",
                    },
                    register: {
                        type: ["string", "null"],
                        description:
                            "Formality or style constraints such as formal, casual, polite-casual, technical, or null when not relevant.",
                    },
                    region: {
                        type: ["string", "null"],
                        description:
                            "Regional variety where this expression is natural or preferred, such as US or UK; use null when not relevant.",
                    },
                    domain: {
                        type: ["array", "null"],
                        description:
                            "Lightweight usage domains for retrieval, such as food, restaurant, engineering, or document.",
                        items: { type: "string" },
                    },
                    meaningNote: {
                        type: ["string", "null"],
                        description:
                            "What this expression means in this inquiry context, especially if the same text is ambiguous.",
                    },
                    usageNote: {
                        type: ["string", "null"],
                        description:
                            "How to use the expression naturally, including collocation, pragmatics, register, or contrast with alternatives.",
                    },
                    role: {
                        type: "string",
                        enum: entityRoles,
                        description:
                            "Role of this expression in the KnowledgePoint: primary learning target, supporting context, contrast, or context.",
                    },
                    evidence: {
                        type: "array",
                        description:
                            "Short transcript-grounded reasons or quotes showing why this expression matters for the inquiry.",
                        items: { type: "string" },
                    },
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
            description:
                "Sparse evidence-based links between concept and expression candidates. Every tempRef must come from conceptCandidates or expressionCandidates.",
            items: {
                type: "object",
                description:
                    "A candidate relation to create between two extracted entity candidates.",
                properties: {
                    fromTempRef: {
                        type: "string",
                        description:
                            "tempRef of the source candidate for this relation.",
                    },
                    toTempRef: {
                        type: "string",
                        description:
                            "tempRef of the target candidate for this relation.",
                    },
                    type: {
                        type: "string",
                        enum: relationTypes,
                        description:
                            "Semantic relation type, such as expresses, contrast_with, confusable_with, used_with, part_of, is_a, or variant_of.",
                    },
                    direction: {
                        type: "string",
                        enum: ["directed", "undirected"],
                        description:
                            "Use directed when fromTempRef points to toTempRef by relation semantics; use undirected for symmetric relations like contrast_with.",
                    },
                    confidence: {
                        type: "number",
                        description:
                            "Model confidence from 0 to 1 that this relation is correct and useful for retrieval or review.",
                    },
                    evidence: {
                        type: "object",
                        description:
                            "Evidence explaining why this relation should exist.",
                        properties: {
                            summary: {
                                type: ["string", "null"],
                                description:
                                    "Short summary of the evidence for this relation.",
                            },
                            sourceMessageIds: {
                                type: "array",
                                description:
                                    "Transcript message IDs that support this relation. Only include IDs present in the input transcript.",
                                items: { type: "string" },
                            },
                            quote: {
                                type: ["string", "null"],
                                description:
                                    "Short supporting quote from the transcript when available; use null when no compact quote is needed.",
                            },
                            reason: {
                                type: ["string", "null"],
                                description:
                                    "Why this relation is useful for the KnowledgePoint, retrieval, distinction, or later practice.",
                            },
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

function normalizedLanguageBase(value: string) {
    const normalized = value.trim().toLowerCase().replace(/_/g, "-");

    switch (normalized) {
        case "english":
            return "en";
        case "chinese":
            return "zh";
        case "german":
            return "de";
        case "japanese":
            return "ja";
        case "french":
            return "fr";
        default:
            return normalized.split("-")[0] ?? normalized;
    }
}

function isTargetLanguageUtterance(language: string, targetLanguage: string) {
    return (
        normalizedLanguageBase(language) ===
        normalizedLanguageBase(targetLanguage)
    );
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
                      const language = asString(utterance.language);

                      if (
                          !text ||
                          !utteranceRoles.includes(
                              role as (typeof utteranceRoles)[number]
                          )
                      ) {
                          return null;
                      }

                      if (
                          language &&
                          !isTargetLanguageUtterance(
                              language,
                              inquiry.targetLanguage
                          )
                      ) {
                          return null;
                      }

                      return {
                          text,
                          language: inquiry.targetLanguage,
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
    useModel: boolean,
    languagePreferences: LanguagePreferenceSettings
) {
    if (!useModel) {
        return createHeuristicDraft(snapshot, inquiry);
    }

    const output = await modelService.structuredOutput({
        schema: draftKnowledgeSchema,
        options: INQUIRY_KNOWLEDGE_DRAFT_PROMPT_OPTIONS,
        input: createInquiryKnowledgeDraftPrompt({
            snapshot,
            inquiry,
            languagePreferences,
        }),
    });

    console.log("[LanguageFriction][inquirySlice=>knowledge][llm]", {
        sessionId: snapshot.sessionId,
        transcriptHash: snapshot.transcriptHash,
        inquiryTempId: inquiry.tempId,
        inquiryTitle: inquiry.title,
        output,
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
        primaryLanguageContext: inquiry.primaryLanguageContext,
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
            primaryLanguageContext: inquiry.primaryLanguageContext,
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
    languagePreferences = DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    useModel = true,
    modelService = languageModelService,
}: SessionExtractionWorkflowInput): Promise<SessionExtractionPreview> {
    const inquirySlices = await segmentInquiries(
        snapshot,
        modelService,
        useModel,
        languagePreferences
    );
    const inquiryPreviews: InquiryExtractionPreview[] = [];

    for (const inquiry of inquirySlices) {
        const draft = await draftKnowledgeForInquiry(
            snapshot,
            inquiry,
            modelService,
            useModel,
            languagePreferences
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
