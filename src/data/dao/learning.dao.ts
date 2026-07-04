import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type { SQLiteDatabase } from "expo-sqlite";

import { getDrizzleDb } from "@/data/database/orm";
import {
    learningEvidence,
    learningTargetEntities,
    learningTargets,
    practiceItems,
    practiceItemTargets,
    userResponses,
} from "@/data/database/schema";
import {
    dateToText,
    jsonToText,
    optionalDateToText,
    optionalJsonToText,
    optionalTextToDate,
    optionalTextToJson,
    textToDate,
    textToJson,
} from "@/data/database/serialization";
import type {
    LearningEvidence,
    LearningTarget,
    LearningTargetEntity,
    PracticeItem,
    PracticeItemTarget,
    UserResponse,
} from "@/types/domain";

type LearningTargetRow = typeof learningTargets.$inferSelect;
type LearningTargetEntityRow = typeof learningTargetEntities.$inferSelect;
type PracticeItemRow = typeof practiceItems.$inferSelect;
type PracticeItemTargetRow = typeof practiceItemTargets.$inferSelect;
type UserResponseRow = typeof userResponses.$inferSelect;
type LearningEvidenceRow = typeof learningEvidence.$inferSelect;

type PracticeItemDataRow = {
    id: string;
    type: PracticeItem["type"];
    promptJson: string;
    expectedAnswerJson: string | null;
    acceptableAnswersJson: string | null;
    contextSnapshotJson: string | null;
    generatedAt: string;
    expiresAt: string | null;
};

type PracticeItemSummaryRow = PracticeItemDataRow & {
    target_count: number | null;
    due_target_count: number | null;
    response_count: number | null;
    latest_submitted_at: string | null;
};

export type PracticeItemSummaryRecord = {
    item: PracticeItem;
    targetCount: number;
    dueTargetCount: number;
    responseCount: number;
    latestSubmittedAt?: Date;
};

function mapLearningTarget(row: LearningTargetRow): LearningTarget {
    return {
        id: row.id,
        userId: row.userId,
        knowledgePointId: row.knowledgePointId ?? undefined,
        ability: row.ability,
        status: row.status,
        priority: row.priority,
        difficulty: row.difficulty ?? undefined,
        stability: row.stability ?? undefined,
        dueAt: optionalTextToDate(row.dueAt),
        lastReviewedAt: optionalTextToDate(row.lastReviewedAt),
        reviewCount: row.reviewCount,
        lapseCount: row.lapseCount,
        schedulingAlgorithm: row.schedulingAlgorithm ?? undefined,
        schedulingVersion: row.schedulingVersion ?? undefined,
        createdAt: textToDate(row.createdAt),
        updatedAt: textToDate(row.updatedAt),
    };
}

function mapLearningTargetEntity(
    row: LearningTargetEntityRow
): LearningTargetEntity {
    return {
        learningTargetId: row.learningTargetId,
        entityType: row.entityType,
        entityId: row.entityId,
        role: row.role,
    };
}

function mapPracticeItemData(row: PracticeItemDataRow): PracticeItem {
    return {
        id: row.id,
        type: row.type,
        prompt: textToJson<unknown>(row.promptJson),
        expectedAnswer: optionalTextToJson<unknown>(row.expectedAnswerJson),
        acceptableAnswers: optionalTextToJson<unknown>(
            row.acceptableAnswersJson
        ),
        contextSnapshot: optionalTextToJson<Record<string, unknown>>(
            row.contextSnapshotJson
        ),
        generatedAt: textToDate(row.generatedAt),
        expiresAt: optionalTextToDate(row.expiresAt),
    };
}

function mapPracticeItem(row: PracticeItemRow): PracticeItem {
    return mapPracticeItemData(row);
}

function mapPracticeItemSummary(
    row: PracticeItemSummaryRow
): PracticeItemSummaryRecord {
    return {
        item: mapPracticeItemData(row),
        targetCount: Number(row.target_count ?? 0),
        dueTargetCount: Number(row.due_target_count ?? 0),
        responseCount: Number(row.response_count ?? 0),
        latestSubmittedAt: optionalTextToDate(row.latest_submitted_at),
    };
}

function mapPracticeItemTarget(row: PracticeItemTargetRow): PracticeItemTarget {
    return {
        practiceItemId: row.practiceItemId,
        learningTargetId: row.learningTargetId,
        weight: row.weight,
    };
}

function mapUserResponse(row: UserResponseRow): UserResponse {
    return {
        id: row.id,
        practiceItemId: row.practiceItemId,
        userId: row.userId,
        answer: textToJson<unknown>(row.answerJson),
        submittedAt: textToDate(row.submittedAt),
        feedback: optionalTextToJson<unknown>(row.feedbackJson),
    };
}

function mapLearningEvidence(row: LearningEvidenceRow): LearningEvidence {
    return {
        id: row.id,
        userResponseId: row.userResponseId,
        learningTargetId: row.learningTargetId,
        result: row.result,
        confidence: row.confidence ?? undefined,
        error: optionalTextToJson<unknown>(row.errorJson),
        createdAt: textToDate(row.createdAt),
    };
}

export class LearningTargetDao {
    private readonly orm;

    constructor(db: SQLiteDatabase) {
        this.orm = getDrizzleDb(db);
    }

    async upsert(target: LearningTarget): Promise<void> {
        const values = {
            id: target.id,
            userId: target.userId,
            knowledgePointId: target.knowledgePointId ?? null,
            ability: target.ability,
            status: target.status,
            priority: target.priority,
            difficulty: target.difficulty ?? null,
            stability: target.stability ?? null,
            dueAt: optionalDateToText(target.dueAt),
            lastReviewedAt: optionalDateToText(target.lastReviewedAt),
            reviewCount: target.reviewCount,
            lapseCount: target.lapseCount,
            schedulingAlgorithm: target.schedulingAlgorithm ?? null,
            schedulingVersion: target.schedulingVersion ?? null,
            createdAt: dateToText(target.createdAt),
            updatedAt: dateToText(target.updatedAt),
        };

        this.orm
            .insert(learningTargets)
            .values(values)
            .onConflictDoUpdate({
                target: learningTargets.id,
                set: {
                    userId: values.userId,
                    knowledgePointId: values.knowledgePointId,
                    ability: values.ability,
                    status: values.status,
                    priority: values.priority,
                    difficulty: values.difficulty,
                    stability: values.stability,
                    dueAt: values.dueAt,
                    lastReviewedAt: values.lastReviewedAt,
                    reviewCount: values.reviewCount,
                    lapseCount: values.lapseCount,
                    schedulingAlgorithm: values.schedulingAlgorithm,
                    schedulingVersion: values.schedulingVersion,
                    updatedAt: values.updatedAt,
                },
            })
            .run();
    }

    async getById(id: string): Promise<LearningTarget | null> {
        const row = this.orm
            .select()
            .from(learningTargets)
            .where(eq(learningTargets.id, id))
            .get();
        return row ? mapLearningTarget(row) : null;
    }

    async getByIds(ids: string[]): Promise<LearningTarget[]> {
        if (ids.length === 0) {
            return [];
        }

        return this.orm
            .select()
            .from(learningTargets)
            .where(inArray(learningTargets.id, ids))
            .all()
            .map(mapLearningTarget);
    }

    async listDue(
        userId: string,
        now = new Date(),
        limit = 50
    ): Promise<LearningTarget[]> {
        return this.orm
            .select()
            .from(learningTargets)
            .where(
                and(
                    eq(learningTargets.userId, userId),
                    eq(learningTargets.status, "active"),
                    or(
                        isNull(learningTargets.dueAt),
                        lte(learningTargets.dueAt, dateToText(now))
                    )
                )
            )
            .orderBy(asc(learningTargets.dueAt), desc(learningTargets.priority))
            .limit(limit)
            .all()
            .map(mapLearningTarget);
    }

    async listByKnowledgePoint(
        userId: string,
        knowledgePointId: string
    ): Promise<LearningTarget[]> {
        return this.orm
            .select()
            .from(learningTargets)
            .where(
                and(
                    eq(learningTargets.userId, userId),
                    eq(learningTargets.knowledgePointId, knowledgePointId)
                )
            )
            .orderBy(
                asc(learningTargets.status),
                asc(learningTargets.dueAt),
                desc(learningTargets.priority)
            )
            .all()
            .map(mapLearningTarget);
    }

    async linkEntity(link: LearningTargetEntity): Promise<void> {
        this.orm
            .insert(learningTargetEntities)
            .values({
                learningTargetId: link.learningTargetId,
                entityType: link.entityType,
                entityId: link.entityId,
                role: link.role,
            })
            .onConflictDoNothing()
            .run();
    }

    async listEntities(
        learningTargetId: string
    ): Promise<LearningTargetEntity[]> {
        return this.orm
            .select()
            .from(learningTargetEntities)
            .where(
                eq(learningTargetEntities.learningTargetId, learningTargetId)
            )
            .orderBy(
                asc(learningTargetEntities.entityType),
                asc(learningTargetEntities.role)
            )
            .all()
            .map(mapLearningTargetEntity);
    }

    async listEntitiesForTargets(
        learningTargetIds: string[]
    ): Promise<LearningTargetEntity[]> {
        if (learningTargetIds.length === 0) {
            return [];
        }

        return this.orm
            .select()
            .from(learningTargetEntities)
            .where(
                inArray(
                    learningTargetEntities.learningTargetId,
                    learningTargetIds
                )
            )
            .orderBy(
                asc(learningTargetEntities.learningTargetId),
                asc(learningTargetEntities.entityType),
                asc(learningTargetEntities.role)
            )
            .all()
            .map(mapLearningTargetEntity);
    }
}

export class PracticeDao {
    private readonly db;
    private readonly orm;

    constructor(db: SQLiteDatabase) {
        this.db = db;
        this.orm = getDrizzleDb(db);
    }

    async upsertPracticeItem(item: PracticeItem): Promise<void> {
        const values = {
            id: item.id,
            type: item.type,
            promptJson: jsonToText(item.prompt),
            expectedAnswerJson: optionalJsonToText(item.expectedAnswer),
            acceptableAnswersJson: optionalJsonToText(item.acceptableAnswers),
            contextSnapshotJson: optionalJsonToText(item.contextSnapshot),
            generatedAt: dateToText(item.generatedAt),
            expiresAt: optionalDateToText(item.expiresAt),
        };

        this.orm
            .insert(practiceItems)
            .values(values)
            .onConflictDoUpdate({
                target: practiceItems.id,
                set: {
                    type: values.type,
                    promptJson: values.promptJson,
                    expectedAnswerJson: values.expectedAnswerJson,
                    acceptableAnswersJson: values.acceptableAnswersJson,
                    contextSnapshotJson: values.contextSnapshotJson,
                    generatedAt: values.generatedAt,
                    expiresAt: values.expiresAt,
                },
            })
            .run();
    }

    async getPracticeItemById(id: string): Promise<PracticeItem | null> {
        const row = this.orm
            .select()
            .from(practiceItems)
            .where(eq(practiceItems.id, id))
            .get();
        return row ? mapPracticeItem(row) : null;
    }

    async listPracticeItemSummariesForUser(
        userId: string,
        now = new Date(),
        limit = 100
    ): Promise<PracticeItemSummaryRecord[]> {
        const rows = await this.db.getAllAsync<PracticeItemSummaryRow>(
            `
SELECT
  practice_items.id AS id,
  practice_items.type AS type,
  practice_items.prompt_json AS promptJson,
  practice_items.expected_answer_json AS expectedAnswerJson,
  practice_items.acceptable_answers_json AS acceptableAnswersJson,
  practice_items.context_snapshot_json AS contextSnapshotJson,
  practice_items.generated_at AS generatedAt,
  practice_items.expires_at AS expiresAt,
  COUNT(DISTINCT practice_item_targets.learning_target_id) AS target_count,
  COUNT(DISTINCT CASE
    WHEN learning_targets.status = 'active'
      AND (learning_targets.due_at IS NULL OR learning_targets.due_at <= ?)
    THEN learning_targets.id
  END) AS due_target_count,
  COUNT(DISTINCT user_responses.id) AS response_count,
  MAX(user_responses.submitted_at) AS latest_submitted_at
FROM practice_items
INNER JOIN practice_item_targets
  ON practice_item_targets.practice_item_id = practice_items.id
INNER JOIN learning_targets
  ON learning_targets.id = practice_item_targets.learning_target_id
LEFT JOIN user_responses
  ON user_responses.practice_item_id = practice_items.id
  AND user_responses.user_id = ?
WHERE learning_targets.user_id = ?
GROUP BY practice_items.id
ORDER BY practice_items.generated_at DESC
LIMIT ?
`,
            [dateToText(now), userId, userId, limit]
        );

        return rows.map(mapPracticeItemSummary);
    }

    async linkTarget(link: PracticeItemTarget): Promise<void> {
        this.orm
            .insert(practiceItemTargets)
            .values({
                practiceItemId: link.practiceItemId,
                learningTargetId: link.learningTargetId,
                weight: link.weight,
            })
            .onConflictDoUpdate({
                target: [
                    practiceItemTargets.practiceItemId,
                    practiceItemTargets.learningTargetId,
                ],
                set: {
                    weight: link.weight,
                },
            })
            .run();
    }

    async listTargets(practiceItemId: string): Promise<PracticeItemTarget[]> {
        return this.orm
            .select()
            .from(practiceItemTargets)
            .where(eq(practiceItemTargets.practiceItemId, practiceItemId))
            .orderBy(desc(practiceItemTargets.weight))
            .all()
            .map(mapPracticeItemTarget);
    }

    async getPracticeStatsForTargets(
        learningTargetIds: string[]
    ): Promise<{ count: number; latestGeneratedAt?: Date }> {
        if (learningTargetIds.length === 0) {
            return { count: 0 };
        }

        const placeholders = learningTargetIds.map(() => "?").join(", ");
        const row = await this.db.getFirstAsync<{
            count: number;
            latest_generated_at: string | null;
        }>(
            `
SELECT
  COUNT(DISTINCT practice_items.id) AS count,
  MAX(practice_items.generated_at) AS latest_generated_at
FROM practice_items
INNER JOIN practice_item_targets
  ON practice_item_targets.practice_item_id = practice_items.id
WHERE practice_item_targets.learning_target_id IN (${placeholders})
`,
            learningTargetIds
        );

        return {
            count: row?.count ?? 0,
            latestGeneratedAt: optionalTextToDate(row?.latest_generated_at),
        };
    }

    async insertUserResponse(response: UserResponse): Promise<void> {
        this.orm
            .insert(userResponses)
            .values({
                id: response.id,
                practiceItemId: response.practiceItemId,
                userId: response.userId,
                answerJson: jsonToText(response.answer),
                submittedAt: dateToText(response.submittedAt),
                feedbackJson: optionalJsonToText(response.feedback),
            })
            .run();
    }

    async getUserResponseById(id: string): Promise<UserResponse | null> {
        const row = this.orm
            .select()
            .from(userResponses)
            .where(eq(userResponses.id, id))
            .get();
        return row ? mapUserResponse(row) : null;
    }

    async listResponsesForPracticeItem(
        practiceItemId: string,
        userId: string,
        limit = 20
    ): Promise<UserResponse[]> {
        return this.orm
            .select()
            .from(userResponses)
            .where(
                and(
                    eq(userResponses.practiceItemId, practiceItemId),
                    eq(userResponses.userId, userId)
                )
            )
            .orderBy(desc(userResponses.submittedAt))
            .limit(limit)
            .all()
            .map(mapUserResponse);
    }

    async insertLearningEvidence(evidence: LearningEvidence): Promise<void> {
        this.orm
            .insert(learningEvidence)
            .values({
                id: evidence.id,
                userResponseId: evidence.userResponseId,
                learningTargetId: evidence.learningTargetId,
                result: evidence.result,
                confidence: evidence.confidence ?? null,
                errorJson: optionalJsonToText(evidence.error),
                createdAt: dateToText(evidence.createdAt),
            })
            .run();
    }

    async listEvidenceForResponses(
        userResponseIds: string[]
    ): Promise<LearningEvidence[]> {
        if (userResponseIds.length === 0) {
            return [];
        }

        return this.orm
            .select()
            .from(learningEvidence)
            .where(inArray(learningEvidence.userResponseId, userResponseIds))
            .orderBy(desc(learningEvidence.createdAt))
            .all()
            .map(mapLearningEvidence);
    }

    async listEvidenceForTarget(
        learningTargetId: string,
        limit = 50
    ): Promise<LearningEvidence[]> {
        return this.orm
            .select()
            .from(learningEvidence)
            .where(eq(learningEvidence.learningTargetId, learningTargetId))
            .orderBy(desc(learningEvidence.createdAt))
            .limit(limit)
            .all()
            .map(mapLearningEvidence);
    }
}
