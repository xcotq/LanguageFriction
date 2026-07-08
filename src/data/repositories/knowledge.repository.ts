import type { SQLiteDatabase } from "expo-sqlite";

import { runWriteTransaction } from "@/data/database/transaction";
import {
    InquiryDao,
    KnowledgeEntityDao,
    KnowledgePointDao,
    RelationDao,
} from "@/data/dao/knowledge.dao";
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
} from "@/types/domain";

export type InquiryExtractionDraft = {
    inquiry: Inquiry;
    inquiryMessages?: InquiryMessage[];
    concepts?: Concept[];
    expressions?: Expression[];
    patterns?: Pattern[];
    knowledgePoints?: KnowledgePoint[];
    utterances?: KnowledgePointUtterance[];
    knowledgePointEntities?: KnowledgePointEntity[];
    relations?: Relation[];
};

export type ApprovedSessionExtraction = {
    sessionId: string;
    userId: string;
    transcriptHash: string;
    approvedAt: Date;
    inquiries: InquiryExtractionDraft[];
};

export type KnowledgePointAggregate = {
    knowledgePoint: KnowledgePoint;
    utterances: KnowledgePointUtterance[];
    entities: KnowledgePointEntity[];
    relations: Relation[];
};

export type KnowledgeEntitySummary =
    | {
          entityType: "concept";
          entity: Concept;
          knowledgePointCount: number;
          learningTargetCount: number;
          relationCount: number;
      }
    | {
          entityType: "expression";
          entity: Expression;
          knowledgePointCount: number;
          learningTargetCount: number;
          relationCount: number;
      }
    | {
          entityType: "pattern";
          entity: Pattern;
          knowledgePointCount: number;
          learningTargetCount: number;
          relationCount: number;
      };

export type KnowledgeEntityRef = Pick<
    KnowledgePointEntity,
    "entityType" | "entityId"
>;

export type DeleteKnowledgePointResult = {
    deletedKnowledgePoint: boolean;
    deletedLearningTargetCount: number;
    deletedPracticeItemCount: number;
    deletedEntityCount: number;
    retainedEntityCount: number;
};

export type DeleteKnowledgeEntityResult = {
    deletedEntity: boolean;
    unlinkedKnowledgePointCount: number;
    deletedLearningTargetCount: number;
    deletedPracticeItemCount: number;
};

type IdRow = {
    id: string;
};

type UserRow = {
    userId: string;
};

function createEmptyDeleteKnowledgePointResult(): DeleteKnowledgePointResult {
    return {
        deletedKnowledgePoint: false,
        deletedLearningTargetCount: 0,
        deletedPracticeItemCount: 0,
        deletedEntityCount: 0,
        retainedEntityCount: 0,
    };
}

function createEmptyDeleteKnowledgeEntityResult(): DeleteKnowledgeEntityResult {
    return {
        deletedEntity: false,
        unlinkedKnowledgePointCount: 0,
        deletedLearningTargetCount: 0,
        deletedPracticeItemCount: 0,
    };
}

function placeholders(values: unknown[]) {
    return values.map(() => "?").join(", ");
}

function entityRefKey(ref: KnowledgeEntityRef) {
    return `${ref.entityType}:${ref.entityId}`;
}

function uniqueEntityRefs(links: KnowledgeEntityRef[]): KnowledgeEntityRef[] {
    const refs = new Map<string, KnowledgeEntityRef>();

    for (const link of links) {
        refs.set(entityRefKey(link), {
            entityType: link.entityType,
            entityId: link.entityId,
        });
    }

    return [...refs.values()];
}

function getSummaryUpdatedAt(summary: KnowledgeEntitySummary) {
    return summary.entity.updatedAt.getTime();
}

async function getKnowledgePointOwnerUserId(
    db: SQLiteDatabase,
    knowledgePointId: string
): Promise<string | null> {
    const row = await db.getFirstAsync<UserRow>(
        `
SELECT sessions.user_id AS userId
FROM knowledge_points
INNER JOIN inquiries
  ON inquiries.id = knowledge_points.inquiry_id
INNER JOIN sessions
  ON sessions.id = inquiries.session_id
WHERE knowledge_points.id = ?
`,
        [knowledgePointId]
    );

    return row?.userId ?? null;
}

async function listLearningTargetIdsForKnowledgePoint(
    db: SQLiteDatabase,
    knowledgePointId: string
) {
    const rows = await db.getAllAsync<IdRow>(
        `
SELECT id
FROM learning_targets
WHERE knowledge_point_id = ?
`,
        [knowledgePointId]
    );

    return rows.map((row) => row.id);
}

async function listLearningTargetIdsForEntity(
    db: SQLiteDatabase,
    ref: KnowledgeEntityRef
) {
    const rows = await db.getAllAsync<{ id: string }>(
        `
SELECT DISTINCT learning_target_id AS id
FROM learning_target_entities
WHERE entity_type = ?
  AND entity_id = ?
`,
        [ref.entityType, ref.entityId]
    );

    return rows.map((row) => row.id);
}

async function listPracticeItemIdsForLearningTargets(
    db: SQLiteDatabase,
    learningTargetIds: string[]
) {
    if (learningTargetIds.length === 0) {
        return [];
    }

    const rows = await db.getAllAsync<{ id: string }>(
        `
SELECT DISTINCT practice_item_id AS id
FROM practice_item_targets
WHERE learning_target_id IN (${placeholders(learningTargetIds)})
`,
        learningTargetIds
    );

    return rows.map((row) => row.id);
}

async function deleteLearningTargets(
    db: SQLiteDatabase,
    learningTargetIds: string[]
) {
    if (learningTargetIds.length === 0) {
        return;
    }

    await db.runAsync(
        `
DELETE FROM learning_targets
WHERE id IN (${placeholders(learningTargetIds)})
`,
        learningTargetIds
    );
}

async function listLearningTargetsWithoutEntities(
    db: SQLiteDatabase,
    learningTargetIds: string[]
) {
    if (learningTargetIds.length === 0) {
        return [];
    }

    const rows = await db.getAllAsync<IdRow>(
        `
SELECT id
FROM learning_targets
WHERE id IN (${placeholders(learningTargetIds)})
  AND NOT EXISTS (
    SELECT 1
    FROM learning_target_entities
    WHERE learning_target_entities.learning_target_id = learning_targets.id
  )
`,
        learningTargetIds
    );

    return rows.map((row) => row.id);
}

async function deletePracticeItemsWithoutTargets(
    db: SQLiteDatabase,
    practiceItemIds: string[]
) {
    if (practiceItemIds.length === 0) {
        return 0;
    }

    const orphanRows = await db.getAllAsync<IdRow>(
        `
SELECT id
FROM practice_items
WHERE id IN (${placeholders(practiceItemIds)})
  AND NOT EXISTS (
    SELECT 1
    FROM practice_item_targets
    WHERE practice_item_targets.practice_item_id = practice_items.id
  )
`,
        practiceItemIds
    );
    const orphanIds = orphanRows.map((row) => row.id);

    if (orphanIds.length === 0) {
        return 0;
    }

    await db.runAsync(
        `
DELETE FROM practice_items
WHERE id IN (${placeholders(orphanIds)})
`,
        orphanIds
    );

    return orphanIds.length;
}

async function knowledgeEntityExists(
    db: SQLiteDatabase,
    ref: KnowledgeEntityRef
) {
    const tableName =
        ref.entityType === "concept"
            ? "concepts"
            : ref.entityType === "expression"
              ? "expressions"
              : "patterns";
    const row = await db.getFirstAsync<IdRow>(
        `SELECT id FROM ${tableName} WHERE id = ?`,
        [ref.entityId]
    );

    return Boolean(row);
}

async function deleteUnanchoredKnowledgeEntities(
    db: SQLiteDatabase,
    refs: KnowledgeEntityRef[]
) {
    const entityDao = new KnowledgeEntityDao(db);
    const relationDao = new RelationDao(db);
    let deletedCount = 0;
    let retainedCount = 0;

    for (const ref of uniqueEntityRefs(refs)) {
        const counts = await entityDao.countReferences(
            ref.entityType,
            ref.entityId
        );

        if (counts.knowledgePointCount > 0 || counts.learningTargetCount > 0) {
            retainedCount += 1;
            continue;
        }

        await relationDao.deleteForEntity(ref.entityType, ref.entityId);
        await entityDao.deleteEntity(ref.entityType, ref.entityId);
        deletedCount += 1;
    }

    return {
        deletedCount,
        retainedCount,
    };
}

async function saveInquiryExtractionDraft(
    db: SQLiteDatabase,
    draft: InquiryExtractionDraft,
    options: { includePatterns: boolean }
) {
    const inquiryDao = new InquiryDao(db);
    const entityDao = new KnowledgeEntityDao(db);
    const knowledgePointDao = new KnowledgePointDao(db);
    const relationDao = new RelationDao(db);

    await inquiryDao.upsert(draft.inquiry);

    for (const link of draft.inquiryMessages ?? []) {
        await inquiryDao.linkMessage(link);
    }

    for (const concept of draft.concepts ?? []) {
        await entityDao.upsertConcept(concept);
    }

    for (const expression of draft.expressions ?? []) {
        await entityDao.upsertExpression(expression);
    }

    if (options.includePatterns) {
        for (const pattern of draft.patterns ?? []) {
            await entityDao.upsertPattern(pattern);
        }
    }

    for (const knowledgePoint of draft.knowledgePoints ?? []) {
        await knowledgePointDao.upsert(knowledgePoint);
    }

    for (const utterance of draft.utterances ?? []) {
        await knowledgePointDao.upsertUtterance(utterance);
    }

    for (const link of draft.knowledgePointEntities ?? []) {
        await knowledgePointDao.linkEntity(link);
    }

    for (const relation of draft.relations ?? []) {
        await relationDao.upsert(relation);
    }
}

export class KnowledgeRepository {
    constructor(private readonly db: SQLiteDatabase) {}

    async saveInquiryExtraction(draft: InquiryExtractionDraft): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            await saveInquiryExtractionDraft(tx, draft, {
                includePatterns: true,
            });
        });
    }

    async saveSessionExtraction(
        extraction: ApprovedSessionExtraction
    ): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            for (const draft of extraction.inquiries) {
                await saveInquiryExtractionDraft(tx, draft, {
                    includePatterns: false,
                });
            }
        });
    }

    async getInquiry(id: string): Promise<Inquiry | null> {
        return new InquiryDao(this.db).getById(id);
    }

    async getKnowledgePoint(
        knowledgePointId: string
    ): Promise<KnowledgePointAggregate | null> {
        const knowledgePointDao = new KnowledgePointDao(this.db);
        const relationDao = new RelationDao(this.db);
        const knowledgePoint =
            await knowledgePointDao.getById(knowledgePointId);

        if (!knowledgePoint) {
            return null;
        }

        const [utterances, entities, relations] = await Promise.all([
            knowledgePointDao.listUtterances(knowledgePointId),
            knowledgePointDao.listEntities(knowledgePointId),
            relationDao.listForEntity("knowledge_point", knowledgePointId),
        ]);

        return {
            knowledgePoint,
            utterances,
            entities,
            relations,
        };
    }

    async listKnowledgeEntities(
        limit = 500
    ): Promise<KnowledgeEntitySummary[]> {
        const entityDao = new KnowledgeEntityDao(this.db);
        const summaries: KnowledgeEntitySummary[] = [];

        const [concepts, expressions, patterns] = await Promise.all([
            entityDao.listConcepts(limit),
            entityDao.listExpressions(limit),
            entityDao.listPatterns(limit),
        ]);

        for (const concept of concepts) {
            const counts = await entityDao.countReferences(
                "concept",
                concept.id
            );

            summaries.push({
                entityType: "concept",
                entity: concept,
                ...counts,
            });
        }

        for (const expression of expressions) {
            const counts = await entityDao.countReferences(
                "expression",
                expression.id
            );

            summaries.push({
                entityType: "expression",
                entity: expression,
                ...counts,
            });
        }

        for (const pattern of patterns) {
            const counts = await entityDao.countReferences(
                "pattern",
                pattern.id
            );

            summaries.push({
                entityType: "pattern",
                entity: pattern,
                ...counts,
            });
        }

        return summaries
            .sort(
                (left, right) =>
                    getSummaryUpdatedAt(right) - getSummaryUpdatedAt(left)
            )
            .slice(0, limit);
    }

    async deleteKnowledgePointCascade(input: {
        userId: string;
        knowledgePointId: string;
    }): Promise<DeleteKnowledgePointResult> {
        return runWriteTransaction(this.db, async (tx) => {
            const ownerUserId = await getKnowledgePointOwnerUserId(
                tx,
                input.knowledgePointId
            );

            if (ownerUserId !== input.userId) {
                return createEmptyDeleteKnowledgePointResult();
            }

            const knowledgePointDao = new KnowledgePointDao(tx);
            const relationDao = new RelationDao(tx);
            const links = await knowledgePointDao.listEntities(
                input.knowledgePointId
            );
            const entityRefs = uniqueEntityRefs(links);
            const learningTargetIds =
                await listLearningTargetIdsForKnowledgePoint(
                    tx,
                    input.knowledgePointId
                );
            const practiceItemIds = await listPracticeItemIdsForLearningTargets(
                tx,
                learningTargetIds
            );

            await relationDao.deleteForEntity(
                "knowledge_point",
                input.knowledgePointId
            );
            await deleteLearningTargets(tx, learningTargetIds);

            const deletedPracticeItemCount =
                await deletePracticeItemsWithoutTargets(tx, practiceItemIds);

            await knowledgePointDao.deleteById(input.knowledgePointId);

            const entityCleanup = await deleteUnanchoredKnowledgeEntities(
                tx,
                entityRefs
            );

            return {
                deletedKnowledgePoint: true,
                deletedLearningTargetCount: learningTargetIds.length,
                deletedPracticeItemCount,
                deletedEntityCount: entityCleanup.deletedCount,
                retainedEntityCount: entityCleanup.retainedCount,
            };
        });
    }

    async deleteKnowledgeEntity(
        input: KnowledgeEntityRef
    ): Promise<DeleteKnowledgeEntityResult> {
        return runWriteTransaction(this.db, async (tx) => {
            if (!(await knowledgeEntityExists(tx, input))) {
                return createEmptyDeleteKnowledgeEntityResult();
            }

            const entityDao = new KnowledgeEntityDao(tx);
            const relationDao = new RelationDao(tx);
            const counts = await entityDao.countReferences(
                input.entityType,
                input.entityId
            );
            const learningTargetIds = await listLearningTargetIdsForEntity(
                tx,
                input
            );
            const practiceItemIds = await listPracticeItemIdsForLearningTargets(
                tx,
                learningTargetIds
            );

            await tx.runAsync(
                `
DELETE FROM knowledge_point_entities
WHERE entity_type = ?
  AND entity_id = ?
`,
                [input.entityType, input.entityId]
            );
            await tx.runAsync(
                `
DELETE FROM learning_target_entities
WHERE entity_type = ?
  AND entity_id = ?
`,
                [input.entityType, input.entityId]
            );

            const emptyLearningTargetIds =
                await listLearningTargetsWithoutEntities(tx, learningTargetIds);

            await deleteLearningTargets(tx, emptyLearningTargetIds);

            const deletedPracticeItemCount =
                await deletePracticeItemsWithoutTargets(tx, practiceItemIds);

            await relationDao.deleteForEntity(input.entityType, input.entityId);
            await entityDao.deleteEntity(input.entityType, input.entityId);

            return {
                deletedEntity: true,
                unlinkedKnowledgePointCount: counts.knowledgePointCount,
                deletedLearningTargetCount: emptyLearningTargetIds.length,
                deletedPracticeItemCount,
            };
        });
    }

    async findExpressions(
        language: string,
        normalizedText: string,
        limit = 20
    ): Promise<Expression[]> {
        return new KnowledgeEntityDao(this.db).findExpressions(
            language,
            normalizedText,
            limit
        );
    }

    async findConcepts(labels: string[], limit = 20): Promise<Concept[]> {
        return new KnowledgeEntityDao(this.db).findConcepts(labels, limit);
    }
}
