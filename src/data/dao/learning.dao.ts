import type { SQLiteDatabase } from "expo-sqlite";

import {
    learningEvidence,
    learningTargetEntities,
    learningTargets,
    practiceResponseFeedback,
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
    textToDate,
    textToJson,
} from "@/data/database/serialization";
import type {
    LearningEvidence,
    LearningTarget,
    LearningTargetEntity,
    PracticeResponseFeedback,
    PracticeItem,
    PracticeItemTarget,
    UserResponse,
} from "@/types/domain";

type LearningTargetRow = typeof learningTargets.$inferSelect;
type LearningTargetEntityRow = typeof learningTargetEntities.$inferSelect;
type PracticeItemRow = typeof practiceItems.$inferSelect;
type PracticeItemTargetRow = typeof practiceItemTargets.$inferSelect;
type UserResponseRow = typeof userResponses.$inferSelect;
type PracticeResponseFeedbackRow = typeof practiceResponseFeedback.$inferSelect;
type LearningEvidenceRow = typeof learningEvidence.$inferSelect;

const learningTargetColumns = `
  id,
  user_id AS userId,
  knowledge_point_id AS knowledgePointId,
  ability,
  status,
  priority,
  difficulty,
  stability,
  due_at AS dueAt,
  last_reviewed_at AS lastReviewedAt,
  review_count AS reviewCount,
  lapse_count AS lapseCount,
  scheduling_algorithm AS schedulingAlgorithm,
  scheduling_version AS schedulingVersion,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const learningTargetEntityColumns = `
  learning_target_id AS learningTargetId,
  entity_type AS entityType,
  entity_id AS entityId,
  role
`;

const practiceItemColumns = `
  id,
  type,
  prompt_json AS promptJson,
  expected_answer_json AS expectedAnswerJson,
  acceptable_answers_json AS acceptableAnswersJson,
  context_snapshot_json AS contextSnapshotJson,
  generated_at AS generatedAt,
  expires_at AS expiresAt
`;

const practiceItemTargetColumns = `
  practice_item_id AS practiceItemId,
  learning_target_id AS learningTargetId,
  weight
`;

const userResponseColumns = `
  id,
  practice_item_id AS practiceItemId,
  user_id AS userId,
  answer_json AS answerJson,
  submitted_at AS submittedAt
`;

const practiceResponseFeedbackColumns = `
  user_response_id AS userResponseId,
  feedback_json AS feedbackJson,
  created_at AS createdAt
`;

const learningEvidenceColumns = `
  id,
  user_response_id AS userResponseId,
  learning_target_id AS learningTargetId,
  result,
  confidence,
  error_json AS errorJson,
  created_at AS createdAt
`;

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

type LearningTargetSummaryRow = LearningTargetRow & {
    knowledgePointTitle: string | null;
    knowledgePointObjective: string | null;
    practice_item_count: number | null;
    latest_practice_generated_at: string | null;
};

export type PracticeItemSummaryRecord = {
    item: PracticeItem;
    targetCount: number;
    dueTargetCount: number;
    responseCount: number;
    latestSubmittedAt?: Date;
};

export type LearningTargetSummaryRecord = {
    target: LearningTarget;
    knowledgePointTitle?: string;
    knowledgePointObjective?: string;
    practiceItemCount: number;
    latestPracticeGeneratedAt?: Date;
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

function parseJsonOrFallback<T>(value: string, fallback: T): T {
    try {
        return textToJson<T>(value);
    } catch (error) {
        console.warn("Failed to parse persisted JSON value.", error);
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
        prompt: parseJsonOrFallback<unknown>(row.promptJson, {
            malformedJson: true,
            raw: row.promptJson,
        }),
        expectedAnswer: parseOptionalJsonOrFallback<unknown>(
            row.expectedAnswerJson,
            undefined
        ),
        acceptableAnswers: parseOptionalJsonOrFallback<unknown>(
            row.acceptableAnswersJson,
            undefined
        ),
        contextSnapshot: parseOptionalJsonOrFallback<Record<string, unknown>>(
            row.contextSnapshotJson,
            undefined
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

function mapLearningTargetSummary(
    row: LearningTargetSummaryRow
): LearningTargetSummaryRecord {
    return {
        target: mapLearningTarget(row),
        knowledgePointTitle: row.knowledgePointTitle ?? undefined,
        knowledgePointObjective: row.knowledgePointObjective ?? undefined,
        practiceItemCount: Number(row.practice_item_count ?? 0),
        latestPracticeGeneratedAt: optionalTextToDate(
            row.latest_practice_generated_at
        ),
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
        answer: parseJsonOrFallback<unknown>(row.answerJson, {
            malformedJson: true,
            raw: row.answerJson,
        }),
        submittedAt: textToDate(row.submittedAt),
    };
}

function mapPracticeResponseFeedback(
    row: PracticeResponseFeedbackRow
): PracticeResponseFeedback {
    return {
        userResponseId: row.userResponseId,
        feedback: parseJsonOrFallback<unknown>(row.feedbackJson, {
            malformedJson: true,
            raw: row.feedbackJson,
        }),
        createdAt: textToDate(row.createdAt),
    };
}

function mapLearningEvidence(row: LearningEvidenceRow): LearningEvidence {
    return {
        id: row.id,
        userResponseId: row.userResponseId,
        learningTargetId: row.learningTargetId,
        result: row.result,
        confidence: row.confidence ?? undefined,
        error: parseOptionalJsonOrFallback<unknown>(row.errorJson, undefined),
        createdAt: textToDate(row.createdAt),
    };
}

export class LearningTargetDao {
    constructor(private readonly db: SQLiteDatabase) {}

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

        await this.db.runAsync(
            `
INSERT INTO learning_targets (
  id, user_id, knowledge_point_id, ability, status, priority, difficulty,
  stability, due_at, last_reviewed_at, review_count, lapse_count,
  scheduling_algorithm, scheduling_version, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  knowledge_point_id = excluded.knowledge_point_id,
  ability = excluded.ability,
  status = excluded.status,
  priority = excluded.priority,
  difficulty = excluded.difficulty,
  stability = excluded.stability,
  due_at = excluded.due_at,
  last_reviewed_at = excluded.last_reviewed_at,
  review_count = excluded.review_count,
  lapse_count = excluded.lapse_count,
  scheduling_algorithm = excluded.scheduling_algorithm,
  scheduling_version = excluded.scheduling_version,
  updated_at = excluded.updated_at
`,
            [
                values.id,
                values.userId,
                values.knowledgePointId,
                values.ability,
                values.status,
                values.priority,
                values.difficulty,
                values.stability,
                values.dueAt,
                values.lastReviewedAt,
                values.reviewCount,
                values.lapseCount,
                values.schedulingAlgorithm,
                values.schedulingVersion,
                values.createdAt,
                values.updatedAt,
            ]
        );
    }

    async getById(id: string): Promise<LearningTarget | null> {
        const row = await this.db.getFirstAsync<LearningTargetRow>(
            `
SELECT ${learningTargetColumns}
FROM learning_targets
WHERE id = ?
`,
            [id]
        );
        return row ? mapLearningTarget(row) : null;
    }

    async getByIds(ids: string[]): Promise<LearningTarget[]> {
        if (ids.length === 0) {
            return [];
        }

        const placeholders = ids.map(() => "?").join(", ");
        const rows = await this.db.getAllAsync<LearningTargetRow>(
            `
SELECT ${learningTargetColumns}
FROM learning_targets
WHERE id IN (${placeholders})
`,
            ids
        );

        return rows.map(mapLearningTarget);
    }

    async listDue(
        userId: string,
        now = new Date(),
        limit = 50
    ): Promise<LearningTarget[]> {
        const rows = await this.db.getAllAsync<LearningTargetRow>(
            `
SELECT ${learningTargetColumns}
FROM learning_targets
WHERE user_id = ?
  AND status = 'active'
  AND (due_at IS NULL OR due_at <= ?)
ORDER BY due_at ASC, priority DESC
LIMIT ?
`,
            [userId, dateToText(now), limit]
        );

        return rows.map(mapLearningTarget);
    }

    async listByUser(
        userId: string,
        limit = 500
    ): Promise<LearningTargetSummaryRecord[]> {
        const rows = await this.db.getAllAsync<LearningTargetSummaryRow>(
            `
SELECT
  target_rows.*,
  knowledge_points.title AS knowledgePointTitle,
  knowledge_points.objective AS knowledgePointObjective,
  COUNT(DISTINCT practice_item_targets.practice_item_id) AS practice_item_count,
  MAX(practice_items.generated_at) AS latest_practice_generated_at
FROM (
  SELECT ${learningTargetColumns}
  FROM learning_targets
  WHERE user_id = ?
) AS target_rows
LEFT JOIN knowledge_points
  ON knowledge_points.id = target_rows.knowledgePointId
LEFT JOIN practice_item_targets
  ON practice_item_targets.learning_target_id = target_rows.id
LEFT JOIN practice_items
  ON practice_items.id = practice_item_targets.practice_item_id
GROUP BY target_rows.id
ORDER BY
  CASE target_rows.status
    WHEN 'active' THEN 0
    WHEN 'paused' THEN 1
    WHEN 'mastered' THEN 2
    ELSE 3
  END ASC,
  CASE WHEN target_rows.dueAt IS NULL THEN 0 ELSE 1 END ASC,
  target_rows.dueAt ASC,
  target_rows.priority DESC,
  target_rows.updatedAt DESC
LIMIT ?
`,
            [userId, limit]
        );

        return rows.map(mapLearningTargetSummary);
    }

    async listByKnowledgePoint(
        userId: string,
        knowledgePointId: string
    ): Promise<LearningTarget[]> {
        const rows = await this.db.getAllAsync<LearningTargetRow>(
            `
SELECT ${learningTargetColumns}
FROM learning_targets
WHERE user_id = ?
  AND knowledge_point_id = ?
ORDER BY status ASC, due_at ASC, priority DESC
`,
            [userId, knowledgePointId]
        );

        return rows.map(mapLearningTarget);
    }

    async linkEntity(link: LearningTargetEntity): Promise<void> {
        await this.db.runAsync(
            `
INSERT OR IGNORE INTO learning_target_entities (
  learning_target_id, entity_type, entity_id, role
)
VALUES (?, ?, ?, ?)
`,
            [link.learningTargetId, link.entityType, link.entityId, link.role]
        );
    }

    async listEntities(
        learningTargetId: string
    ): Promise<LearningTargetEntity[]> {
        const rows = await this.db.getAllAsync<LearningTargetEntityRow>(
            `
SELECT ${learningTargetEntityColumns}
FROM learning_target_entities
WHERE learning_target_id = ?
ORDER BY entity_type ASC, role ASC
`,
            [learningTargetId]
        );

        return rows.map(mapLearningTargetEntity);
    }

    async listEntitiesForTargets(
        learningTargetIds: string[]
    ): Promise<LearningTargetEntity[]> {
        if (learningTargetIds.length === 0) {
            return [];
        }

        const placeholders = learningTargetIds.map(() => "?").join(", ");
        const rows = await this.db.getAllAsync<LearningTargetEntityRow>(
            `
SELECT ${learningTargetEntityColumns}
FROM learning_target_entities
WHERE learning_target_id IN (${placeholders})
ORDER BY learning_target_id ASC, entity_type ASC, role ASC
`,
            learningTargetIds
        );

        return rows.map(mapLearningTargetEntity);
    }

    async deleteById(id: string): Promise<void> {
        await this.db.runAsync(
            `
DELETE FROM learning_targets
WHERE id = ?
`,
            [id]
        );
    }
}

export class PracticeDao {
    constructor(private readonly db: SQLiteDatabase) {}

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

        await this.db.runAsync(
            `
INSERT INTO practice_items (
  id, type, prompt_json, expected_answer_json, acceptable_answers_json,
  context_snapshot_json, generated_at, expires_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  type = excluded.type,
  prompt_json = excluded.prompt_json,
  expected_answer_json = excluded.expected_answer_json,
  acceptable_answers_json = excluded.acceptable_answers_json,
  context_snapshot_json = excluded.context_snapshot_json,
  generated_at = excluded.generated_at,
  expires_at = excluded.expires_at
`,
            [
                values.id,
                values.type,
                values.promptJson,
                values.expectedAnswerJson,
                values.acceptableAnswersJson,
                values.contextSnapshotJson,
                values.generatedAt,
                values.expiresAt,
            ]
        );
    }

    async getPracticeItemById(id: string): Promise<PracticeItem | null> {
        const row = await this.db.getFirstAsync<PracticeItemRow>(
            `
SELECT ${practiceItemColumns}
FROM practice_items
WHERE id = ?
`,
            [id]
        );
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
        await this.db.runAsync(
            `
INSERT INTO practice_item_targets (
  practice_item_id, learning_target_id, weight
)
VALUES (?, ?, ?)
ON CONFLICT(practice_item_id, learning_target_id) DO UPDATE SET
  weight = excluded.weight
`,
            [link.practiceItemId, link.learningTargetId, link.weight]
        );
    }

    async listTargets(practiceItemId: string): Promise<PracticeItemTarget[]> {
        const rows = await this.db.getAllAsync<PracticeItemTargetRow>(
            `
SELECT ${practiceItemTargetColumns}
FROM practice_item_targets
WHERE practice_item_id = ?
ORDER BY weight DESC
`,
            [practiceItemId]
        );

        return rows.map(mapPracticeItemTarget);
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

    async listPracticeItemIdsForLearningTargets(
        learningTargetIds: string[]
    ): Promise<string[]> {
        if (learningTargetIds.length === 0) {
            return [];
        }

        const placeholders = learningTargetIds.map(() => "?").join(", ");
        const rows = await this.db.getAllAsync<{ id: string }>(
            `
SELECT DISTINCT practice_item_id AS id
FROM practice_item_targets
WHERE learning_target_id IN (${placeholders})
`,
            learningTargetIds
        );

        return rows.map((row) => row.id);
    }

    async deletePracticeItemsWithoutTargets(
        practiceItemIds: string[]
    ): Promise<number> {
        if (practiceItemIds.length === 0) {
            return 0;
        }

        const placeholders = practiceItemIds.map(() => "?").join(", ");
        const orphanRows = await this.db.getAllAsync<{ id: string }>(
            `
SELECT id
FROM practice_items
WHERE id IN (${placeholders})
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

        const orphanPlaceholders = orphanIds.map(() => "?").join(", ");
        await this.db.runAsync(
            `
DELETE FROM practice_items
WHERE id IN (${orphanPlaceholders})
`,
            orphanIds
        );

        return orphanIds.length;
    }

    async insertUserResponse(response: UserResponse): Promise<void> {
        await this.db.runAsync(
            `
INSERT INTO user_responses (
  id, practice_item_id, user_id, answer_json, submitted_at
)
VALUES (?, ?, ?, ?, ?)
`,
            [
                response.id,
                response.practiceItemId,
                response.userId,
                jsonToText(response.answer),
                dateToText(response.submittedAt),
            ]
        );
    }

    async getUserResponseById(id: string): Promise<UserResponse | null> {
        const row = await this.db.getFirstAsync<UserResponseRow>(
            `
SELECT ${userResponseColumns}
FROM user_responses
WHERE id = ?
`,
            [id]
        );
        return row ? mapUserResponse(row) : null;
    }

    async listResponsesForPracticeItem(
        practiceItemId: string,
        userId: string,
        limit = 20
    ): Promise<UserResponse[]> {
        const rows = await this.db.getAllAsync<UserResponseRow>(
            `
SELECT ${userResponseColumns}
FROM user_responses
WHERE practice_item_id = ?
  AND user_id = ?
ORDER BY submitted_at DESC
LIMIT ?
`,
            [practiceItemId, userId, limit]
        );

        return rows.map(mapUserResponse);
    }

    async insertPracticeResponseFeedback(
        feedback: PracticeResponseFeedback
    ): Promise<void> {
        await this.db.runAsync(
            `
INSERT INTO practice_response_feedback (
  user_response_id, feedback_json, created_at
)
VALUES (?, ?, ?)
ON CONFLICT(user_response_id) DO UPDATE SET
  feedback_json = excluded.feedback_json,
  created_at = excluded.created_at
`,
            [
                feedback.userResponseId,
                jsonToText(feedback.feedback),
                dateToText(feedback.createdAt),
            ]
        );
    }

    async listPracticeResponseFeedbackForResponses(
        userResponseIds: string[]
    ): Promise<PracticeResponseFeedback[]> {
        if (userResponseIds.length === 0) {
            return [];
        }

        const placeholders = userResponseIds.map(() => "?").join(", ");
        const rows = await this.db.getAllAsync<PracticeResponseFeedbackRow>(
            `
SELECT ${practiceResponseFeedbackColumns}
FROM practice_response_feedback
WHERE user_response_id IN (${placeholders})
`,
            userResponseIds
        );

        return rows.map(mapPracticeResponseFeedback);
    }

    async insertLearningEvidence(evidence: LearningEvidence): Promise<void> {
        await this.db.runAsync(
            `
INSERT INTO learning_evidence (
  id, user_response_id, learning_target_id, result, confidence, error_json,
  created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?)
`,
            [
                evidence.id,
                evidence.userResponseId,
                evidence.learningTargetId,
                evidence.result,
                evidence.confidence ?? null,
                optionalJsonToText(evidence.error),
                dateToText(evidence.createdAt),
            ]
        );
    }

    async listEvidenceForResponses(
        userResponseIds: string[]
    ): Promise<LearningEvidence[]> {
        if (userResponseIds.length === 0) {
            return [];
        }

        const placeholders = userResponseIds.map(() => "?").join(", ");
        const rows = await this.db.getAllAsync<LearningEvidenceRow>(
            `
SELECT ${learningEvidenceColumns}
FROM learning_evidence
WHERE user_response_id IN (${placeholders})
ORDER BY created_at DESC
`,
            userResponseIds
        );

        return rows.map(mapLearningEvidence);
    }

    async listEvidenceForTarget(
        learningTargetId: string,
        limit = 50
    ): Promise<LearningEvidence[]> {
        const rows = await this.db.getAllAsync<LearningEvidenceRow>(
            `
SELECT ${learningEvidenceColumns}
FROM learning_evidence
WHERE learning_target_id = ?
ORDER BY created_at DESC
LIMIT ?
`,
            [learningTargetId, limit]
        );

        return rows.map(mapLearningEvidence);
    }
}
