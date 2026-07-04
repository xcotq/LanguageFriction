import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { SQLiteDatabase } from "expo-sqlite";

import { getDrizzleDb } from "@/data/database/orm";
import {
    concepts,
    expressions,
    inquiries,
    inquiryMessages,
    knowledgePointEntities,
    knowledgePoints,
    knowledgePointUtterances,
    patterns,
    relations,
} from "@/data/database/schema";
import {
    dateToText,
    jsonToText,
    optionalJsonToText,
    optionalTextToJson,
    textToDate,
    textToJson,
    textToJsonWithFallback,
} from "@/data/database/serialization";
import type {
    Concept,
    Expression,
    Inquiry,
    InquiryMessage,
    KnowledgePoint,
    KnowledgePointEntity,
    KnowledgePointUtterance,
    Pattern,
    Relation,
    RelationEntityType,
    PatternSlot,
} from "@/types/domain";

type InquiryRow = typeof inquiries.$inferSelect;
type InquiryMessageRow = typeof inquiryMessages.$inferSelect;
type ConceptRow = typeof concepts.$inferSelect;
type ExpressionRow = typeof expressions.$inferSelect;
type PatternRow = typeof patterns.$inferSelect;
type KnowledgePointRow = typeof knowledgePoints.$inferSelect;
type KnowledgePointUtteranceRow = typeof knowledgePointUtterances.$inferSelect;
type KnowledgePointEntityRow = typeof knowledgePointEntities.$inferSelect;
type RelationRow = typeof relations.$inferSelect;

function mapInquiry(row: InquiryRow): Inquiry {
    return {
        id: row.id,
        sessionId: row.sessionId,
        title: row.title,
        userNeed: row.userNeed,
        contextSummary: row.contextSummary,
        sourceLanguage: row.sourceLanguage ?? undefined,
        targetLanguage: row.targetLanguage,
        status: row.status,
        createdFrom: row.createdFrom,
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function mapInquiryMessage(row: InquiryMessageRow): InquiryMessage {
    return {
        inquiryId: row.inquiryId,
        messageId: row.messageId,
        role: row.role,
        sequence: row.sequence ?? undefined,
    };
}

function mapConcept(row: ConceptRow): Concept {
    return {
        id: row.id,
        canonicalLabel: row.canonicalLabel,
        languageHint: row.languageHint ?? undefined,
        definition: row.definition ?? undefined,
        domain: optionalTextToJson<string[]>(row.domainJson),
        aliases: optionalTextToJson<string[]>(row.aliasesJson),
        disambiguationNote: row.disambiguationNote ?? undefined,
        status: row.status,
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function mapExpression(row: ExpressionRow): Expression {
    return {
        id: row.id,
        text: row.text,
        language: row.language,
        normalizedText: row.normalizedText,
        partOfSpeech: row.partOfSpeech ?? undefined,
        register: row.register ?? undefined,
        region: row.region ?? undefined,
        domain: optionalTextToJson<string[]>(row.domainJson),
        meaningNote: row.meaningNote ?? undefined,
        usageNote: row.usageNote ?? undefined,
        status: row.status,
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function mapPattern(row: PatternRow): Pattern {
    return {
        id: row.id,
        template: row.template,
        language: row.language,
        slots: textToJson<PatternSlot[]>(row.slotsJson),
        explanation: row.explanation ?? undefined,
        usageScope: row.usageScope ?? undefined,
        confidence: row.confidence,
        source: row.source,
        status: row.status,
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function mapKnowledgePoint(row: KnowledgePointRow): KnowledgePoint {
    return {
        id: row.id,
        inquiryId: row.inquiryId,
        title: row.title,
        objective: row.objective,
        contextSnapshot: textToJsonWithFallback<Record<string, unknown>>(
            row.contextSnapshotJson,
            {}
        ),
        explanation: row.explanation ?? undefined,
        status: row.status,
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function mapKnowledgePointUtterance(
    row: KnowledgePointUtteranceRow
): KnowledgePointUtterance {
    return {
        id: row.id,
        knowledgePointId: row.knowledgePointId,
        text: row.text,
        language: row.language,
        role: row.role,
        usageNote: row.usageNote ?? undefined,
        createdAt: textToDate(row.createdAt),
    };
}

function mapKnowledgePointEntity(
    row: KnowledgePointEntityRow
): KnowledgePointEntity {
    return {
        knowledgePointId: row.knowledgePointId,
        entityType: row.entityType,
        entityId: row.entityId,
        role: row.role,
    };
}

function mapRelation(row: RelationRow): Relation {
    return {
        id: row.id,
        fromType: row.fromType,
        fromId: row.fromId,
        toType: row.toType,
        toId: row.toId,
        type: row.type,
        direction: row.direction,
        confidence: row.confidence,
        source: row.source,
        status: row.status,
        evidence: optionalTextToJson<Record<string, unknown>>(row.evidenceJson),
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function normalizeConceptLookupText(text: string) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function conceptMatchesLabels(concept: Concept, labels: Set<string>) {
    if (labels.has(normalizeConceptLookupText(concept.canonicalLabel))) {
        return true;
    }

    return (concept.aliases ?? []).some((alias) =>
        labels.has(normalizeConceptLookupText(alias))
    );
}

export class InquiryDao {
    private readonly orm;

    constructor(db: SQLiteDatabase) {
        this.orm = getDrizzleDb(db);
    }

    async upsert(inquiry: Inquiry): Promise<void> {
        const values = {
            id: inquiry.id,
            sessionId: inquiry.sessionId,
            title: inquiry.title,
            userNeed: inquiry.userNeed,
            contextSummary: inquiry.contextSummary,
            sourceLanguage: inquiry.sourceLanguage ?? null,
            targetLanguage: inquiry.targetLanguage,
            status: inquiry.status,
            createdFrom: inquiry.createdFrom,
            createdAt: dateToText(inquiry.createdAt),
            updatedAt: dateToText(inquiry.updatedAt),
        };

        this.orm
            .insert(inquiries)
            .values(values)
            .onConflictDoUpdate({
                target: inquiries.id,
                set: values,
            })
            .run();
    }

    async linkMessage(link: InquiryMessage): Promise<void> {
        this.orm
            .insert(inquiryMessages)
            .values({
                inquiryId: link.inquiryId,
                messageId: link.messageId,
                role: link.role,
                sequence: link.sequence ?? null,
            })
            .onConflictDoUpdate({
                target: [
                    inquiryMessages.inquiryId,
                    inquiryMessages.messageId,
                    inquiryMessages.role,
                ],
                set: {
                    sequence: link.sequence ?? null,
                },
            })
            .run();
    }

    async getById(id: string): Promise<Inquiry | null> {
        const row = this.orm
            .select()
            .from(inquiries)
            .where(eq(inquiries.id, id))
            .get();
        return row ? mapInquiry(row) : null;
    }

    async listBySessionId(sessionId: string): Promise<Inquiry[]> {
        return this.orm
            .select()
            .from(inquiries)
            .where(eq(inquiries.sessionId, sessionId))
            .orderBy(asc(inquiries.createdAt))
            .all()
            .map(mapInquiry);
    }

    async getMessageLinks(inquiryId: string): Promise<InquiryMessage[]> {
        return this.orm
            .select()
            .from(inquiryMessages)
            .where(eq(inquiryMessages.inquiryId, inquiryId))
            .orderBy(asc(inquiryMessages.sequence))
            .all()
            .map(mapInquiryMessage);
    }
}

export class KnowledgeEntityDao {
    private readonly orm;

    constructor(db: SQLiteDatabase) {
        this.orm = getDrizzleDb(db);
    }

    async upsertConcept(concept: Concept): Promise<void> {
        const values = {
            id: concept.id,
            canonicalLabel: concept.canonicalLabel,
            languageHint: concept.languageHint ?? null,
            definition: concept.definition ?? null,
            domainJson: optionalJsonToText(concept.domain),
            aliasesJson: optionalJsonToText(concept.aliases),
            disambiguationNote: concept.disambiguationNote ?? null,
            status: concept.status,
            createdAt: dateToText(concept.createdAt),
            updatedAt: dateToText(concept.updatedAt),
        };

        this.orm
            .insert(concepts)
            .values(values)
            .onConflictDoUpdate({
                target: concepts.id,
                set: {
                    canonicalLabel: values.canonicalLabel,
                    languageHint: values.languageHint,
                    definition: values.definition,
                    domainJson: values.domainJson,
                    aliasesJson: values.aliasesJson,
                    disambiguationNote: values.disambiguationNote,
                    status: values.status,
                    updatedAt: values.updatedAt,
                },
            })
            .run();
    }

    async getConceptById(id: string): Promise<Concept | null> {
        const row = this.orm
            .select()
            .from(concepts)
            .where(eq(concepts.id, id))
            .get();
        return row ? mapConcept(row) : null;
    }

    async findConcepts(labels: string[], limit = 20): Promise<Concept[]> {
        const lookupLabels = labels
            .map((label) => label.trim())
            .filter(Boolean);
        const normalizedLabels = new Set(
            lookupLabels.map(normalizeConceptLookupText)
        );

        if (normalizedLabels.size === 0) {
            return [];
        }

        const directRows =
            lookupLabels.length > 0
                ? this.orm
                      .select()
                      .from(concepts)
                      .where(inArray(concepts.canonicalLabel, lookupLabels))
                      .orderBy(desc(concepts.updatedAt))
                      .limit(limit)
                      .all()
                : [];
        const recentRows = this.orm
            .select()
            .from(concepts)
            .orderBy(desc(concepts.updatedAt))
            .limit(200)
            .all();
        const matchedConcepts = new Map<string, Concept>();

        for (const row of [...directRows, ...recentRows]) {
            const concept = mapConcept(row);

            if (conceptMatchesLabels(concept, normalizedLabels)) {
                matchedConcepts.set(concept.id, concept);
            }
        }

        return [...matchedConcepts.values()].slice(0, limit);
    }

    async upsertExpression(expression: Expression): Promise<void> {
        const values = {
            id: expression.id,
            text: expression.text,
            language: expression.language,
            normalizedText: expression.normalizedText,
            partOfSpeech: expression.partOfSpeech ?? null,
            register: expression.register ?? null,
            region: expression.region ?? null,
            domainJson: optionalJsonToText(expression.domain),
            meaningNote: expression.meaningNote ?? null,
            usageNote: expression.usageNote ?? null,
            status: expression.status,
            createdAt: dateToText(expression.createdAt),
            updatedAt: dateToText(expression.updatedAt),
        };

        this.orm
            .insert(expressions)
            .values(values)
            .onConflictDoUpdate({
                target: expressions.id,
                set: {
                    text: values.text,
                    language: values.language,
                    normalizedText: values.normalizedText,
                    partOfSpeech: values.partOfSpeech,
                    register: values.register,
                    region: values.region,
                    domainJson: values.domainJson,
                    meaningNote: values.meaningNote,
                    usageNote: values.usageNote,
                    status: values.status,
                    updatedAt: values.updatedAt,
                },
            })
            .run();
    }

    async getExpressionById(id: string): Promise<Expression | null> {
        const row = this.orm
            .select()
            .from(expressions)
            .where(eq(expressions.id, id))
            .get();
        return row ? mapExpression(row) : null;
    }

    async getExpressionsByIds(ids: string[]): Promise<Expression[]> {
        if (ids.length === 0) {
            return [];
        }

        return this.orm
            .select()
            .from(expressions)
            .where(inArray(expressions.id, ids))
            .all()
            .map(mapExpression);
    }

    async findExpressions(
        language: string,
        normalizedText: string,
        limit = 20
    ): Promise<Expression[]> {
        return this.orm
            .select()
            .from(expressions)
            .where(
                and(
                    eq(expressions.language, language),
                    eq(expressions.normalizedText, normalizedText)
                )
            )
            .orderBy(desc(expressions.updatedAt))
            .limit(limit)
            .all()
            .map(mapExpression);
    }

    async upsertPattern(pattern: Pattern): Promise<void> {
        const values = {
            id: pattern.id,
            template: pattern.template,
            language: pattern.language,
            slotsJson: jsonToText(pattern.slots),
            explanation: pattern.explanation ?? null,
            usageScope: pattern.usageScope ?? null,
            confidence: pattern.confidence,
            source: pattern.source,
            status: pattern.status,
            createdAt: dateToText(pattern.createdAt),
            updatedAt: dateToText(pattern.updatedAt),
        };

        this.orm
            .insert(patterns)
            .values(values)
            .onConflictDoUpdate({
                target: patterns.id,
                set: {
                    template: values.template,
                    language: values.language,
                    slotsJson: values.slotsJson,
                    explanation: values.explanation,
                    usageScope: values.usageScope,
                    confidence: values.confidence,
                    source: values.source,
                    status: values.status,
                    updatedAt: values.updatedAt,
                },
            })
            .run();
    }

    async getPatternById(id: string): Promise<Pattern | null> {
        const row = this.orm
            .select()
            .from(patterns)
            .where(eq(patterns.id, id))
            .get();
        return row ? mapPattern(row) : null;
    }
}

export class KnowledgePointDao {
    private readonly orm;

    constructor(db: SQLiteDatabase) {
        this.orm = getDrizzleDb(db);
    }

    async upsert(knowledgePoint: KnowledgePoint): Promise<void> {
        const values = {
            id: knowledgePoint.id,
            inquiryId: knowledgePoint.inquiryId,
            title: knowledgePoint.title,
            objective: knowledgePoint.objective,
            contextSnapshotJson: jsonToText(knowledgePoint.contextSnapshot),
            explanation: knowledgePoint.explanation ?? null,
            status: knowledgePoint.status,
            createdAt: dateToText(knowledgePoint.createdAt),
            updatedAt: dateToText(knowledgePoint.updatedAt),
        };

        this.orm
            .insert(knowledgePoints)
            .values(values)
            .onConflictDoUpdate({
                target: knowledgePoints.id,
                set: {
                    inquiryId: values.inquiryId,
                    title: values.title,
                    objective: values.objective,
                    contextSnapshotJson: values.contextSnapshotJson,
                    explanation: values.explanation,
                    status: values.status,
                    updatedAt: values.updatedAt,
                },
            })
            .run();
    }

    async getById(id: string): Promise<KnowledgePoint | null> {
        const row = this.orm
            .select()
            .from(knowledgePoints)
            .where(eq(knowledgePoints.id, id))
            .get();
        return row ? mapKnowledgePoint(row) : null;
    }

    async listByInquiryId(inquiryId: string): Promise<KnowledgePoint[]> {
        return this.orm
            .select()
            .from(knowledgePoints)
            .where(eq(knowledgePoints.inquiryId, inquiryId))
            .orderBy(asc(knowledgePoints.createdAt))
            .all()
            .map(mapKnowledgePoint);
    }

    async upsertUtterance(utterance: KnowledgePointUtterance): Promise<void> {
        const values = {
            id: utterance.id,
            knowledgePointId: utterance.knowledgePointId,
            text: utterance.text,
            language: utterance.language,
            role: utterance.role,
            usageNote: utterance.usageNote ?? null,
            createdAt: dateToText(utterance.createdAt),
        };

        this.orm
            .insert(knowledgePointUtterances)
            .values(values)
            .onConflictDoUpdate({
                target: knowledgePointUtterances.id,
                set: {
                    knowledgePointId: values.knowledgePointId,
                    text: values.text,
                    language: values.language,
                    role: values.role,
                    usageNote: values.usageNote,
                },
            })
            .run();
    }

    async listUtterances(
        knowledgePointId: string
    ): Promise<KnowledgePointUtterance[]> {
        return this.orm
            .select()
            .from(knowledgePointUtterances)
            .where(
                eq(knowledgePointUtterances.knowledgePointId, knowledgePointId)
            )
            .orderBy(asc(knowledgePointUtterances.createdAt))
            .all()
            .map(mapKnowledgePointUtterance);
    }

    async linkEntity(link: KnowledgePointEntity): Promise<void> {
        this.orm
            .insert(knowledgePointEntities)
            .values({
                knowledgePointId: link.knowledgePointId,
                entityType: link.entityType,
                entityId: link.entityId,
                role: link.role,
            })
            .onConflictDoNothing()
            .run();
    }

    async listEntities(
        knowledgePointId: string
    ): Promise<KnowledgePointEntity[]> {
        return this.orm
            .select()
            .from(knowledgePointEntities)
            .where(
                eq(knowledgePointEntities.knowledgePointId, knowledgePointId)
            )
            .orderBy(
                asc(knowledgePointEntities.entityType),
                asc(knowledgePointEntities.role)
            )
            .all()
            .map(mapKnowledgePointEntity);
    }
}

export class RelationDao {
    private readonly orm;

    constructor(db: SQLiteDatabase) {
        this.orm = getDrizzleDb(db);
    }

    async upsert(relation: Relation): Promise<void> {
        const values = {
            id: relation.id,
            fromType: relation.fromType,
            fromId: relation.fromId,
            toType: relation.toType,
            toId: relation.toId,
            type: relation.type,
            direction: relation.direction,
            confidence: relation.confidence,
            source: relation.source,
            status: relation.status,
            evidenceJson: optionalJsonToText(relation.evidence),
            createdAt: dateToText(relation.createdAt),
            updatedAt: dateToText(relation.updatedAt),
        };

        this.orm
            .insert(relations)
            .values(values)
            .onConflictDoUpdate({
                target: relations.id,
                set: {
                    fromType: values.fromType,
                    fromId: values.fromId,
                    toType: values.toType,
                    toId: values.toId,
                    type: values.type,
                    direction: values.direction,
                    confidence: values.confidence,
                    source: values.source,
                    status: values.status,
                    evidenceJson: values.evidenceJson,
                    updatedAt: values.updatedAt,
                },
            })
            .run();
    }

    async listForEntity(
        entityType: RelationEntityType,
        entityId: string
    ): Promise<Relation[]> {
        return this.orm
            .select()
            .from(relations)
            .where(
                or(
                    and(
                        eq(relations.fromType, entityType),
                        eq(relations.fromId, entityId)
                    ),
                    and(
                        eq(relations.toType, entityType),
                        eq(relations.toId, entityId)
                    )
                )
            )
            .orderBy(desc(relations.updatedAt))
            .all()
            .map(mapRelation);
    }
}
