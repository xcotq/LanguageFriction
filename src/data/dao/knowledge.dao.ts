import type { SQLiteDatabase } from "expo-sqlite";

import {
    dateToText,
    jsonToText,
    optionalJsonToText,
    textToDate,
    textToJson,
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

type InquiryRow = {
    id: string;
    sessionId: string;
    title: string;
    userNeed: string;
    contextSummary: string;
    primaryLanguageContext: string;
    sourceLanguage: string | null;
    targetLanguage: string;
    status: Inquiry["status"];
    createdFrom: Inquiry["createdFrom"];
    createdAt: string;
    updatedAt: string;
};

type InquiryMessageRow = {
    inquiryId: string;
    messageId: string;
    role: InquiryMessage["role"];
    sequence: number | null;
};

type ConceptRow = {
    id: string;
    canonicalLabel: string;
    languageHint: string | null;
    definition: string | null;
    domainJson: string | null;
    aliasesJson: string | null;
    disambiguationNote: string | null;
    status: Concept["status"];
    createdAt: string;
    updatedAt: string;
};

type ExpressionRow = {
    id: string;
    text: string;
    language: string;
    normalizedText: string;
    partOfSpeech: string | null;
    register: string | null;
    region: string | null;
    domainJson: string | null;
    meaningNote: string | null;
    usageNote: string | null;
    status: Expression["status"];
    createdAt: string;
    updatedAt: string;
};

type PatternRow = {
    id: string;
    template: string;
    language: string;
    slotsJson: string;
    explanation: string | null;
    usageScope: string | null;
    confidence: number;
    source: Pattern["source"];
    status: Pattern["status"];
    createdAt: string;
    updatedAt: string;
};

type KnowledgePointRow = {
    id: string;
    inquiryId: string;
    title: string;
    objective: string;
    contextSnapshotJson: string;
    explanation: string | null;
    status: KnowledgePoint["status"];
    createdAt: string;
    updatedAt: string;
};

type KnowledgePointUtteranceRow = {
    id: string;
    knowledgePointId: string;
    text: string;
    language: string;
    role: KnowledgePointUtterance["role"];
    usageNote: string | null;
    createdAt: string;
};

type KnowledgePointEntityRow = {
    knowledgePointId: string;
    entityType: KnowledgePointEntity["entityType"];
    entityId: string;
    role: KnowledgePointEntity["role"];
};

type RelationRow = {
    id: string;
    fromType: Relation["fromType"];
    fromId: string;
    toType: Relation["toType"];
    toId: string;
    type: Relation["type"];
    direction: Relation["direction"];
    confidence: number;
    source: Relation["source"];
    status: Relation["status"];
    evidenceJson: string | null;
    createdAt: string;
    updatedAt: string;
};

export type KnowledgeEntityReferenceCounts = {
    knowledgePointCount: number;
    learningTargetCount: number;
    relationCount: number;
};

const inquiryColumns = `
  id,
  session_id AS sessionId,
  title,
  user_need AS userNeed,
  context_summary AS contextSummary,
  primary_language_context AS primaryLanguageContext,
  source_language AS sourceLanguage,
  target_language AS targetLanguage,
  status,
  created_from AS createdFrom,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const inquiryMessageColumns = `
  inquiry_id AS inquiryId,
  message_id AS messageId,
  role,
  sequence
`;

const conceptColumns = `
  id,
  canonical_label AS canonicalLabel,
  language_hint AS languageHint,
  definition,
  domain_json AS domainJson,
  aliases_json AS aliasesJson,
  disambiguation_note AS disambiguationNote,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const expressionColumns = `
  id,
  text,
  language,
  normalized_text AS normalizedText,
  part_of_speech AS partOfSpeech,
  register,
  region,
  domain_json AS domainJson,
  meaning_note AS meaningNote,
  usage_note AS usageNote,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const patternColumns = `
  id,
  template,
  language,
  slots_json AS slotsJson,
  explanation,
  usage_scope AS usageScope,
  confidence,
  source,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const knowledgePointColumns = `
  id,
  inquiry_id AS inquiryId,
  title,
  objective,
  context_snapshot_json AS contextSnapshotJson,
  explanation,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const knowledgePointUtteranceColumns = `
  id,
  knowledge_point_id AS knowledgePointId,
  text,
  language,
  role,
  usage_note AS usageNote,
  created_at AS createdAt
`;

const knowledgePointEntityColumns = `
  knowledge_point_id AS knowledgePointId,
  entity_type AS entityType,
  entity_id AS entityId,
  role
`;

const relationColumns = `
  id,
  from_type AS fromType,
  from_id AS fromId,
  to_type AS toType,
  to_id AS toId,
  type,
  direction,
  confidence,
  source,
  status,
  evidence_json AS evidenceJson,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function parseJsonOrFallback<T>(value: string, fallback: T): T {
    try {
        return textToJson<T>(value);
    } catch (error) {
        console.warn("Failed to parse persisted knowledge JSON value.", error);
        return fallback;
    }
}

function parseOptionalJsonOrFallback<T>(
    value: string | null | undefined,
    fallback: T | undefined
): T | undefined {
    if (value == null) {
        return undefined;
    }

    return parseJsonOrFallback<T | undefined>(value, fallback);
}

function mapInquiry(row: InquiryRow): Inquiry {
    return {
        id: row.id,
        sessionId: row.sessionId,
        title: row.title,
        userNeed: row.userNeed,
        contextSummary: row.contextSummary,
        primaryLanguageContext: row.primaryLanguageContext,
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
        domain: parseOptionalJsonOrFallback<string[]>(row.domainJson, []),
        aliases: parseOptionalJsonOrFallback<string[]>(row.aliasesJson, []),
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
        domain: parseOptionalJsonOrFallback<string[]>(row.domainJson, []),
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
        slots: parseJsonOrFallback<PatternSlot[]>(row.slotsJson, []),
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
        contextSnapshot: parseJsonOrFallback<Record<string, unknown>>(
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
        evidence: parseOptionalJsonOrFallback<Record<string, unknown>>(
            row.evidenceJson,
            undefined
        ),
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
    constructor(private readonly db: SQLiteDatabase) {}

    async upsert(inquiry: Inquiry): Promise<void> {
        const values = {
            id: inquiry.id,
            sessionId: inquiry.sessionId,
            title: inquiry.title,
            userNeed: inquiry.userNeed,
            contextSummary: inquiry.contextSummary,
            primaryLanguageContext: inquiry.primaryLanguageContext,
            sourceLanguage: inquiry.sourceLanguage ?? null,
            targetLanguage: inquiry.targetLanguage,
            status: inquiry.status,
            createdFrom: inquiry.createdFrom,
            createdAt: dateToText(inquiry.createdAt),
            updatedAt: dateToText(inquiry.updatedAt),
        };

        await this.db.runAsync(
            `
INSERT INTO inquiries (
  id, session_id, title, user_need, context_summary, primary_language_context,
  source_language, target_language, status, created_from, created_at,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  session_id = excluded.session_id,
  title = excluded.title,
  user_need = excluded.user_need,
  context_summary = excluded.context_summary,
  primary_language_context = excluded.primary_language_context,
  source_language = excluded.source_language,
  target_language = excluded.target_language,
  status = excluded.status,
  created_from = excluded.created_from,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.sessionId,
                values.title,
                values.userNeed,
                values.contextSummary,
                values.primaryLanguageContext,
                values.sourceLanguage,
                values.targetLanguage,
                values.status,
                values.createdFrom,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async linkMessage(link: InquiryMessage): Promise<void> {
        await this.db.runAsync(
            `
INSERT INTO inquiry_messages (
  inquiry_id, message_id, role, sequence
)
VALUES (?, ?, ?, ?)
ON CONFLICT(inquiry_id, message_id, role) DO UPDATE SET
  sequence = excluded.sequence
`,
            [link.inquiryId, link.messageId, link.role, link.sequence ?? null]
        );
    }

    async getById(id: string): Promise<Inquiry | null> {
        const row = await this.db.getFirstAsync<InquiryRow>(
            `
SELECT ${inquiryColumns}
FROM inquiries
WHERE id = ?
`,
            [id]
        );
        return row ? mapInquiry(row) : null;
    }

    async listBySessionId(sessionId: string): Promise<Inquiry[]> {
        const rows = await this.db.getAllAsync<InquiryRow>(
            `
SELECT ${inquiryColumns}
FROM inquiries
WHERE session_id = ?
ORDER BY created_at ASC
`,
            [sessionId]
        );

        return rows.map(mapInquiry);
    }

    async getMessageLinks(inquiryId: string): Promise<InquiryMessage[]> {
        const rows = await this.db.getAllAsync<InquiryMessageRow>(
            `
SELECT ${inquiryMessageColumns}
FROM inquiry_messages
WHERE inquiry_id = ?
ORDER BY sequence ASC
`,
            [inquiryId]
        );

        return rows.map(mapInquiryMessage);
    }
}

export class KnowledgeEntityDao {
    constructor(private readonly db: SQLiteDatabase) {}

    async listConcepts(limit = 500): Promise<Concept[]> {
        const rows = await this.db.getAllAsync<ConceptRow>(
            `
SELECT ${conceptColumns}
FROM concepts
ORDER BY updated_at DESC
LIMIT ?
`,
            [limit]
        );

        return rows.map(mapConcept);
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

        await this.db.runAsync(
            `
INSERT INTO concepts (
  id, canonical_label, language_hint, definition, domain_json, aliases_json,
  disambiguation_note, status, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  canonical_label = excluded.canonical_label,
  language_hint = excluded.language_hint,
  definition = excluded.definition,
  domain_json = excluded.domain_json,
  aliases_json = excluded.aliases_json,
  disambiguation_note = excluded.disambiguation_note,
  status = excluded.status,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.canonicalLabel,
                values.languageHint,
                values.definition,
                values.domainJson,
                values.aliasesJson,
                values.disambiguationNote,
                values.status,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async getConceptById(id: string): Promise<Concept | null> {
        const row = await this.db.getFirstAsync<ConceptRow>(
            `
SELECT ${conceptColumns}
FROM concepts
WHERE id = ?
`,
            [id]
        );
        return row ? mapConcept(row) : null;
    }

    async getConceptsByIds(ids: string[]): Promise<Concept[]> {
        if (ids.length === 0) {
            return [];
        }

        const rows = await this.db.getAllAsync<ConceptRow>(
            `
SELECT ${conceptColumns}
FROM concepts
WHERE id IN (${ids.map(() => "?").join(", ")})
`,
            ids
        );

        return rows.map(mapConcept);
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
                ? await this.db.getAllAsync<ConceptRow>(
                      `
SELECT ${conceptColumns}
FROM concepts
WHERE canonical_label IN (${lookupLabels.map(() => "?").join(", ")})
ORDER BY updated_at DESC
LIMIT ?
`,
                      [...lookupLabels, limit]
                  )
                : [];
        const recentRows = await this.db.getAllAsync<ConceptRow>(
            `
SELECT ${conceptColumns}
FROM concepts
ORDER BY updated_at DESC
LIMIT 200
`
        );
        const matchedConcepts = new Map<string, Concept>();

        for (const row of [...directRows, ...recentRows]) {
            const concept = mapConcept(row);

            if (conceptMatchesLabels(concept, normalizedLabels)) {
                matchedConcepts.set(concept.id, concept);
            }
        }

        return [...matchedConcepts.values()].slice(0, limit);
    }

    async listExpressions(limit = 500): Promise<Expression[]> {
        const rows = await this.db.getAllAsync<ExpressionRow>(
            `
SELECT ${expressionColumns}
FROM expressions
ORDER BY updated_at DESC
LIMIT ?
`,
            [limit]
        );

        return rows.map(mapExpression);
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

        await this.db.runAsync(
            `
INSERT INTO expressions (
  id, text, language, normalized_text, part_of_speech, register, region,
  domain_json, meaning_note, usage_note, status, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  language = excluded.language,
  normalized_text = excluded.normalized_text,
  part_of_speech = excluded.part_of_speech,
  register = excluded.register,
  region = excluded.region,
  domain_json = excluded.domain_json,
  meaning_note = excluded.meaning_note,
  usage_note = excluded.usage_note,
  status = excluded.status,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.text,
                values.language,
                values.normalizedText,
                values.partOfSpeech,
                values.register,
                values.region,
                values.domainJson,
                values.meaningNote,
                values.usageNote,
                values.status,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async getExpressionById(id: string): Promise<Expression | null> {
        const row = await this.db.getFirstAsync<ExpressionRow>(
            `
SELECT ${expressionColumns}
FROM expressions
WHERE id = ?
`,
            [id]
        );
        return row ? mapExpression(row) : null;
    }

    async getExpressionsByIds(ids: string[]): Promise<Expression[]> {
        if (ids.length === 0) {
            return [];
        }

        const rows = await this.db.getAllAsync<ExpressionRow>(
            `
SELECT ${expressionColumns}
FROM expressions
WHERE id IN (${ids.map(() => "?").join(", ")})
`,
            ids
        );

        return rows.map(mapExpression);
    }

    async findExpressions(
        language: string,
        normalizedText: string,
        limit = 20
    ): Promise<Expression[]> {
        const rows = await this.db.getAllAsync<ExpressionRow>(
            `
SELECT ${expressionColumns}
FROM expressions
WHERE language = ?
  AND normalized_text = ?
ORDER BY updated_at DESC
LIMIT ?
`,
            [language, normalizedText, limit]
        );

        return rows.map(mapExpression);
    }

    async listPatterns(limit = 500): Promise<Pattern[]> {
        const rows = await this.db.getAllAsync<PatternRow>(
            `
SELECT ${patternColumns}
FROM patterns
ORDER BY updated_at DESC
LIMIT ?
`,
            [limit]
        );

        return rows.map(mapPattern);
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

        await this.db.runAsync(
            `
INSERT INTO patterns (
  id, template, language, slots_json, explanation, usage_scope, confidence,
  source, status, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  template = excluded.template,
  language = excluded.language,
  slots_json = excluded.slots_json,
  explanation = excluded.explanation,
  usage_scope = excluded.usage_scope,
  confidence = excluded.confidence,
  source = excluded.source,
  status = excluded.status,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.template,
                values.language,
                values.slotsJson,
                values.explanation,
                values.usageScope,
                values.confidence,
                values.source,
                values.status,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async getPatternById(id: string): Promise<Pattern | null> {
        const row = await this.db.getFirstAsync<PatternRow>(
            `
SELECT ${patternColumns}
FROM patterns
WHERE id = ?
`,
            [id]
        );
        return row ? mapPattern(row) : null;
    }

    async countReferences(
        entityType: KnowledgePointEntity["entityType"],
        entityId: string
    ): Promise<KnowledgeEntityReferenceCounts> {
        const knowledgePointRow = await this.db.getFirstAsync<{
            count: number;
        }>(
            `
SELECT COUNT(DISTINCT knowledge_point_id) AS count
FROM knowledge_point_entities
WHERE entity_type = ?
  AND entity_id = ?
`,
            [entityType, entityId]
        );
        const learningTargetRow = await this.db.getFirstAsync<{
            count: number;
        }>(
            `
SELECT COUNT(DISTINCT learning_target_id) AS count
FROM learning_target_entities
WHERE entity_type = ?
  AND entity_id = ?
`,
            [entityType, entityId]
        );
        const relationRow = await this.db.getFirstAsync<{ count: number }>(
            `
SELECT COUNT(*) AS count
FROM relations
WHERE (from_type = ? AND from_id = ?)
   OR (to_type = ? AND to_id = ?)
`,
            [entityType, entityId, entityType, entityId]
        );

        return {
            knowledgePointCount: Number(knowledgePointRow?.count ?? 0),
            learningTargetCount: Number(learningTargetRow?.count ?? 0),
            relationCount: Number(relationRow?.count ?? 0),
        };
    }

    async deleteEntity(
        entityType: KnowledgePointEntity["entityType"],
        entityId: string
    ): Promise<void> {
        if (entityType === "concept") {
            await this.db.runAsync("DELETE FROM concepts WHERE id = ?", [
                entityId,
            ]);
            return;
        }

        if (entityType === "expression") {
            await this.db.runAsync("DELETE FROM expressions WHERE id = ?", [
                entityId,
            ]);
            return;
        }

        await this.db.runAsync("DELETE FROM patterns WHERE id = ?", [entityId]);
    }
}

export class KnowledgePointDao {
    constructor(private readonly db: SQLiteDatabase) {}

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

        await this.db.runAsync(
            `
INSERT INTO knowledge_points (
  id, inquiry_id, title, objective, context_snapshot_json, explanation,
  status, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  inquiry_id = excluded.inquiry_id,
  title = excluded.title,
  objective = excluded.objective,
  context_snapshot_json = excluded.context_snapshot_json,
  explanation = excluded.explanation,
  status = excluded.status,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.inquiryId,
                values.title,
                values.objective,
                values.contextSnapshotJson,
                values.explanation,
                values.status,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async getById(id: string): Promise<KnowledgePoint | null> {
        const row = await this.db.getFirstAsync<KnowledgePointRow>(
            `
SELECT ${knowledgePointColumns}
FROM knowledge_points
WHERE id = ?
`,
            [id]
        );
        return row ? mapKnowledgePoint(row) : null;
    }

    async listByInquiryId(inquiryId: string): Promise<KnowledgePoint[]> {
        const rows = await this.db.getAllAsync<KnowledgePointRow>(
            `
SELECT ${knowledgePointColumns}
FROM knowledge_points
WHERE inquiry_id = ?
ORDER BY created_at ASC
`,
            [inquiryId]
        );

        return rows.map(mapKnowledgePoint);
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

        await this.db.runAsync(
            `
INSERT INTO knowledge_point_utterances (
  id, knowledge_point_id, text, language, role, usage_note, created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  knowledge_point_id = excluded.knowledge_point_id,
  text = excluded.text,
  language = excluded.language,
  role = excluded.role,
  usage_note = excluded.usage_note
`,
            [
                values.id,
                values.knowledgePointId,
                values.text,
                values.language,
                values.role,
                values.usageNote,
                values.createdAt,
            ]
        );
    }

    async listUtterances(
        knowledgePointId: string
    ): Promise<KnowledgePointUtterance[]> {
        const rows = await this.db.getAllAsync<KnowledgePointUtteranceRow>(
            `
SELECT ${knowledgePointUtteranceColumns}
FROM knowledge_point_utterances
WHERE knowledge_point_id = ?
ORDER BY created_at ASC
`,
            [knowledgePointId]
        );

        return rows.map(mapKnowledgePointUtterance);
    }

    async linkEntity(link: KnowledgePointEntity): Promise<void> {
        await this.db.runAsync(
            `
INSERT OR IGNORE INTO knowledge_point_entities (
  knowledge_point_id, entity_type, entity_id, role
)
VALUES (?, ?, ?, ?)
`,
            [link.knowledgePointId, link.entityType, link.entityId, link.role]
        );
    }

    async listEntities(
        knowledgePointId: string
    ): Promise<KnowledgePointEntity[]> {
        const rows = await this.db.getAllAsync<KnowledgePointEntityRow>(
            `
SELECT ${knowledgePointEntityColumns}
FROM knowledge_point_entities
WHERE knowledge_point_id = ?
ORDER BY entity_type ASC, role ASC
`,
            [knowledgePointId]
        );

        return rows.map(mapKnowledgePointEntity);
    }

    async deleteById(knowledgePointId: string): Promise<void> {
        await this.db.runAsync("DELETE FROM knowledge_points WHERE id = ?", [
            knowledgePointId,
        ]);
    }
}

export class RelationDao {
    constructor(private readonly db: SQLiteDatabase) {}

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

        await this.db.runAsync(
            `
INSERT INTO relations (
  id, from_type, from_id, to_type, to_id, type, direction, confidence,
  source, status, evidence_json, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  from_type = excluded.from_type,
  from_id = excluded.from_id,
  to_type = excluded.to_type,
  to_id = excluded.to_id,
  type = excluded.type,
  direction = excluded.direction,
  confidence = excluded.confidence,
  source = excluded.source,
  status = excluded.status,
  evidence_json = excluded.evidence_json,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.fromType,
                values.fromId,
                values.toType,
                values.toId,
                values.type,
                values.direction,
                values.confidence,
                values.source,
                values.status,
                values.evidenceJson,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async listForEntity(
        entityType: RelationEntityType,
        entityId: string
    ): Promise<Relation[]> {
        const rows = await this.db.getAllAsync<RelationRow>(
            `
SELECT ${relationColumns}
FROM relations
WHERE (from_type = ? AND from_id = ?)
   OR (to_type = ? AND to_id = ?)
ORDER BY updated_at DESC
`,
            [entityType, entityId, entityType, entityId]
        );

        return rows.map(mapRelation);
    }

    async deleteForEntity(
        entityType: RelationEntityType,
        entityId: string
    ): Promise<void> {
        await this.db.runAsync(
            `
DELETE FROM relations
WHERE (from_type = ? AND from_id = ?)
   OR (to_type = ? AND to_id = ?)
`,
            [entityType, entityId, entityType, entityId]
        );
    }
}
