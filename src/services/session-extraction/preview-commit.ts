import type { ApprovedSessionExtraction } from "@/data/repositories/knowledge.repository";
import type {
    Concept,
    Expression,
    KnowledgePointEntity,
    RelationEntityType,
} from "@/types/domain";

import {
    createDeterministicId,
    normalizeLookupText,
    stableHash,
} from "./stable";
import type {
    EntityResolutionPreview,
    InquiryExtractionPreview,
    SessionExtractionPreview,
} from "./types";

type ResolvedPreviewEntity = {
    tempRef: string;
    entityType: "concept" | "expression";
    entityId: string;
    resolution: EntityResolutionPreview;
};

function compactIdPart(value: string) {
    const compact = normalizeLookupText(value)
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);

    return compact || "value";
}

function createConceptId(concept: NonNullable<Concept["canonicalLabel"]>) {
    return createDeterministicId("concept", normalizeLookupText(concept));
}

function createExpressionId(language: string, normalizedText: string) {
    return `expr:${compactIdPart(language)}:${stableHash(normalizedText)}`;
}

function createInquiryId(
    preview: SessionExtractionPreview,
    inquiryPreview: InquiryExtractionPreview,
    index: number
) {
    return createDeterministicId("inquiry", {
        sessionId: preview.sessionId,
        transcriptHash: preview.transcriptHash,
        tempId: inquiryPreview.tempId,
        index,
    });
}

function resolveEntityId(resolution: EntityResolutionPreview) {
    if (resolution.decision === "link_existing") {
        return resolution.existingEntityId;
    }

    if (resolution.decision !== "create_new") {
        return undefined;
    }

    if (resolution.entityType === "concept") {
        return createConceptId(
            resolution.draft?.canonicalLabel ?? resolution.displayLabel
        );
    }

    return createExpressionId(
        resolution.draft?.language ?? "en",
        resolution.draft?.normalizedText ??
            normalizeLookupText(resolution.displayLabel)
    );
}

function collectEntities(
    inquiryPreview: InquiryExtractionPreview,
    approvedAt: Date
) {
    const concepts = new Map<string, Concept>();
    const expressions = new Map<string, Expression>();
    const resolvedEntities = new Map<string, ResolvedPreviewEntity>();

    for (const resolution of inquiryPreview.entities) {
        const entityId = resolveEntityId(resolution);

        if (!entityId) {
            continue;
        }

        resolvedEntities.set(resolution.tempRef, {
            tempRef: resolution.tempRef,
            entityType: resolution.entityType,
            entityId,
            resolution,
        });

        if (resolution.decision !== "create_new") {
            continue;
        }

        if (resolution.entityType === "concept") {
            const draft = resolution.draft;

            concepts.set(entityId, {
                id: entityId,
                canonicalLabel:
                    draft?.canonicalLabel ?? resolution.displayLabel,
                languageHint: draft?.languageHint,
                definition: draft?.definition,
                domain: draft?.domain,
                aliases: draft?.aliases,
                disambiguationNote: draft?.disambiguationNote,
                status: "active",
                createdAt: approvedAt,
                updatedAt: approvedAt,
            });
        } else {
            const draft = resolution.draft;

            expressions.set(entityId, {
                id: entityId,
                text: draft?.text ?? resolution.displayLabel,
                language: draft?.language ?? "en",
                normalizedText:
                    draft?.normalizedText ??
                    normalizeLookupText(resolution.displayLabel),
                partOfSpeech: draft?.partOfSpeech,
                register: draft?.register,
                region: draft?.region,
                domain: draft?.domain,
                meaningNote: draft?.meaningNote,
                usageNote: draft?.usageNote,
                status: "active",
                createdAt: approvedAt,
                updatedAt: approvedAt,
            });
        }
    }

    return {
        concepts: [...concepts.values()],
        expressions: [...expressions.values()],
        resolvedEntities,
    };
}

function createKnowledgePointEntities(
    knowledgePointId: string,
    resolvedEntities: Map<string, ResolvedPreviewEntity>
) {
    const links = new Map<string, KnowledgePointEntity>();

    for (const entity of resolvedEntities.values()) {
        const link: KnowledgePointEntity = {
            knowledgePointId,
            entityType: entity.entityType,
            entityId: entity.entityId,
            role: entity.resolution.role,
        };
        links.set(
            [
                link.knowledgePointId,
                link.entityType,
                link.entityId,
                link.role,
            ].join("|"),
            link
        );
    }

    return [...links.values()];
}

function createRelationEntityType(entityType: "concept" | "expression") {
    return entityType as RelationEntityType;
}

export function approveSessionExtractionPreview(
    preview: SessionExtractionPreview,
    approvedAt = new Date()
): ApprovedSessionExtraction {
    return {
        sessionId: preview.sessionId,
        userId: preview.userId,
        transcriptHash: preview.transcriptHash,
        approvedAt,
        inquiries: preview.inquiryPreviews.map((inquiryPreview, index) => {
            const inquiryId = createInquiryId(preview, inquiryPreview, index);
            const knowledgePointId = createDeterministicId("kp", inquiryId);
            const { concepts, expressions, resolvedEntities } = collectEntities(
                inquiryPreview,
                approvedAt
            );

            return {
                inquiry: {
                    id: inquiryId,
                    sessionId: preview.sessionId,
                    title: inquiryPreview.inquiry.title,
                    userNeed: inquiryPreview.inquiry.userNeed,
                    contextSummary: inquiryPreview.inquiry.contextSummary,
                    sourceLanguage: inquiryPreview.inquiry.sourceLanguage,
                    targetLanguage: inquiryPreview.inquiry.targetLanguage,
                    status: "extracted",
                    createdFrom: "auto_summary",
                    createdAt: approvedAt,
                    updatedAt: approvedAt,
                },
                inquiryMessages: inquiryPreview.inquiry.messageLinks.map(
                    (link) => ({
                        inquiryId,
                        messageId: link.messageId,
                        role: link.role,
                        sequence: link.sequence,
                    })
                ),
                concepts,
                expressions,
                patterns: [],
                knowledgePoints: [
                    {
                        id: knowledgePointId,
                        inquiryId,
                        title: inquiryPreview.knowledgePoint.title,
                        objective: inquiryPreview.knowledgePoint.objective,
                        contextSnapshot:
                            inquiryPreview.knowledgePoint.contextSnapshot,
                        explanation: inquiryPreview.knowledgePoint.explanation,
                        status: "active",
                        createdAt: approvedAt,
                        updatedAt: approvedAt,
                    },
                ],
                utterances: inquiryPreview.utterances.map(
                    (utterance, utteranceIndex) => ({
                        id: createDeterministicId("utt", {
                            knowledgePointId,
                            text: utterance.text,
                            role: utterance.role,
                            index: utteranceIndex,
                        }),
                        knowledgePointId,
                        text: utterance.text,
                        language: utterance.language,
                        role: utterance.role,
                        usageNote: utterance.usageNote,
                        createdAt: approvedAt,
                    })
                ),
                knowledgePointEntities: createKnowledgePointEntities(
                    knowledgePointId,
                    resolvedEntities
                ),
                relations: inquiryPreview.relations.flatMap((relation) => {
                    const from = resolvedEntities.get(relation.fromTempRef);
                    const to = resolvedEntities.get(relation.toTempRef);

                    if (!from || !to) {
                        return [];
                    }

                    return [
                        {
                            id: createDeterministicId("rel", {
                                fromType: from.entityType,
                                fromId: from.entityId,
                                toType: to.entityType,
                                toId: to.entityId,
                                type: relation.type,
                                direction: relation.direction,
                            }),
                            fromType: createRelationEntityType(from.entityType),
                            fromId: from.entityId,
                            toType: createRelationEntityType(to.entityType),
                            toId: to.entityId,
                            type: relation.type,
                            direction: relation.direction,
                            confidence: relation.confidence,
                            source: "inquiry",
                            status: "confirmed",
                            evidence: {
                                ...relation.evidence,
                                transcriptHash: preview.transcriptHash,
                                inquiryTempId: inquiryPreview.tempId,
                            },
                            createdAt: approvedAt,
                            updatedAt: approvedAt,
                        },
                    ];
                }),
            };
        }),
    };
}
