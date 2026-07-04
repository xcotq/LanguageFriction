import type { SQLiteDatabase } from "expo-sqlite";

import { runWriteTransaction } from "@/data/database/transaction";
import {
    LearningTargetDao,
    PracticeDao,
    type PracticeItemSummaryRecord,
} from "@/data/dao/learning.dao";
import type {
    LearningEvidence,
    LearningTarget,
    LearningTargetEntity,
    PracticeItem,
    PracticeItemTarget,
    UserResponse,
} from "@/types/domain";

export type PracticeItemDraft = {
    item: PracticeItem;
    targets: PracticeItemTarget[];
};

export type LearningTargetDraft = {
    target: LearningTarget;
    entities: LearningTargetEntity[];
};

export type LearningTargetWithEntities = {
    target: LearningTarget;
    entities: LearningTargetEntity[];
};

export type PracticeResponseDraft = {
    response: UserResponse;
    evidence: LearningEvidence[];
};

export type EvaluatedPracticeResponseDraft = PracticeResponseDraft & {
    targetUpdates: LearningTarget[];
};

export type PracticeItemSummary = PracticeItemSummaryRecord;

export type PracticeItemTargetDetail = {
    link: PracticeItemTarget;
    target: LearningTarget;
    entities: LearningTargetEntity[];
};

export type PracticeItemResponseDetail = {
    response: UserResponse;
    evidence: LearningEvidence[];
};

export type PracticeItemDetail = PracticeItemSummary & {
    targets: PracticeItemTargetDetail[];
    responses: PracticeItemResponseDetail[];
};

function formatResponseTimestamp(date: Date) {
    const pad = (value: number, length = 2) =>
        value.toString().padStart(length, "0");

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
        pad(date.getMilliseconds(), 3),
    ].join("");
}

function createManualResponseId(input: {
    practiceItemId: string;
    userId: string;
    now: Date;
}) {
    const suffix = Math.random().toString(36).slice(2, 8);

    return `response:${input.practiceItemId}:${input.userId}:${formatResponseTimestamp(input.now)}:${suffix}`;
}

function isDueTarget(target: LearningTarget, now: Date) {
    return target.status === "active" && (!target.dueAt || target.dueAt <= now);
}

export class PracticeRepository {
    constructor(private readonly db: SQLiteDatabase) {}

    async saveLearningTarget(
        target: LearningTarget,
        entities: LearningTargetEntity[] = []
    ): Promise<void> {
        await this.saveLearningTargets([{ target, entities }]);
    }

    async saveLearningTargets(drafts: LearningTargetDraft[]): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            const targetDao = new LearningTargetDao(tx);

            for (const draft of drafts) {
                await targetDao.upsert(draft.target);

                for (const entity of draft.entities) {
                    await targetDao.linkEntity(entity);
                }
            }
        });
    }

    async getDueTargets(
        userId: string,
        now = new Date(),
        limit = 50
    ): Promise<LearningTarget[]> {
        return new LearningTargetDao(this.db).listDue(userId, now, limit);
    }

    async getLearningTargetWithEntities(
        learningTargetId: string,
        userId?: string
    ): Promise<LearningTargetWithEntities | null> {
        const targetDao = new LearningTargetDao(this.db);
        const target = await targetDao.getById(learningTargetId);

        if (!target || (userId && target.userId !== userId)) {
            return null;
        }

        return {
            target,
            entities: await targetDao.listEntities(target.id),
        };
    }

    async listLearningTargetsForKnowledgePoint(
        userId: string,
        knowledgePointId: string
    ): Promise<LearningTargetWithEntities[]> {
        const targetDao = new LearningTargetDao(this.db);
        const targets = await targetDao.listByKnowledgePoint(
            userId,
            knowledgePointId
        );

        return Promise.all(
            targets.map(async (target) => ({
                target,
                entities: await targetDao.listEntities(target.id),
            }))
        );
    }

    async savePracticeItem(draft: PracticeItemDraft): Promise<void> {
        await this.savePracticeItems([draft]);
    }

    async savePracticeItems(drafts: PracticeItemDraft[]): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            const practiceDao = new PracticeDao(tx);

            for (const draft of drafts) {
                await practiceDao.upsertPracticeItem(draft.item);

                for (const target of draft.targets) {
                    await practiceDao.linkTarget(target);
                }
            }
        });
    }

    async listPracticeItemSummaries(
        userId: string,
        now = new Date(),
        limit = 100
    ): Promise<PracticeItemSummary[]> {
        return new PracticeDao(this.db).listPracticeItemSummariesForUser(
            userId,
            now,
            limit
        );
    }

    async getPracticeItemDetail(
        userId: string,
        practiceItemId: string,
        now = new Date()
    ): Promise<PracticeItemDetail | null> {
        const practiceDao = new PracticeDao(this.db);
        const targetDao = new LearningTargetDao(this.db);
        const item = await practiceDao.getPracticeItemById(practiceItemId);

        if (!item) {
            return null;
        }

        const links = await practiceDao.listTargets(item.id);
        const targets = await targetDao.getByIds(
            links.map((link) => link.learningTargetId)
        );
        const targetsById = new Map(
            targets
                .filter((target) => target.userId === userId)
                .map((target) => [target.id, target])
        );
        const userTargetIds = [...targetsById.keys()];

        if (userTargetIds.length === 0) {
            return null;
        }

        const targetEntities =
            await targetDao.listEntitiesForTargets(userTargetIds);
        const entitiesByTargetId = new Map<string, LearningTargetEntity[]>();

        for (const entity of targetEntities) {
            const existing = entitiesByTargetId.get(entity.learningTargetId);

            if (existing) {
                existing.push(entity);
            } else {
                entitiesByTargetId.set(entity.learningTargetId, [entity]);
            }
        }

        const targetDetails = links.flatMap<PracticeItemTargetDetail>(
            (link) => {
                const target = targetsById.get(link.learningTargetId);

                return target
                    ? [
                          {
                              link,
                              target,
                              entities:
                                  entitiesByTargetId.get(
                                      link.learningTargetId
                                  ) ?? [],
                          },
                      ]
                    : [];
            }
        );
        const responses = await practiceDao.listResponsesForPracticeItem(
            item.id,
            userId
        );
        const evidence = await practiceDao.listEvidenceForResponses(
            responses.map((response) => response.id)
        );
        const evidenceByResponseId = new Map<string, LearningEvidence[]>();

        for (const itemEvidence of evidence) {
            const existing = evidenceByResponseId.get(
                itemEvidence.userResponseId
            );

            if (existing) {
                existing.push(itemEvidence);
            } else {
                evidenceByResponseId.set(itemEvidence.userResponseId, [
                    itemEvidence,
                ]);
            }
        }

        return {
            item,
            targetCount: targetDetails.length,
            dueTargetCount: targetDetails.filter(({ target }) =>
                isDueTarget(target, now)
            ).length,
            responseCount: responses.length,
            latestSubmittedAt: responses[0]?.submittedAt,
            targets: targetDetails,
            responses: responses.map((response) => ({
                response,
                evidence: evidenceByResponseId.get(response.id) ?? [],
            })),
        };
    }

    async recordUnevaluatedResponse(input: {
        userId: string;
        practiceItemId: string;
        answer: unknown;
        now?: Date;
    }): Promise<PracticeItemResponseDetail> {
        const now = input.now ?? new Date();
        const detail = await this.getPracticeItemDetail(
            input.userId,
            input.practiceItemId,
            now
        );

        if (!detail) {
            throw new Error("Practice item not found.");
        }

        const responseId = createManualResponseId({
            practiceItemId: input.practiceItemId,
            userId: input.userId,
            now,
        });
        const response: UserResponse = {
            id: responseId,
            practiceItemId: input.practiceItemId,
            userId: input.userId,
            answer: input.answer,
            submittedAt: now,
            feedback: {
                summary: "Response saved. Evaluation has not run yet.",
            },
        };
        const evidence: LearningEvidence[] = detail.targets.map(
            ({ target }) => ({
                id: `evidence:${responseId}:${target.id}`,
                userResponseId: responseId,
                learningTargetId: target.id,
                result: "not_tested",
                error: {
                    reason: "manual_response_without_evaluator",
                },
                createdAt: now,
            })
        );

        await this.recordResponse({ response, evidence });

        return {
            response,
            evidence,
        };
    }

    async getPracticeStatsForLearningTargets(
        learningTargetIds: string[]
    ): Promise<{ count: number; latestGeneratedAt?: Date }> {
        return new PracticeDao(this.db).getPracticeStatsForTargets(
            learningTargetIds
        );
    }

    async recordResponse(draft: PracticeResponseDraft): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            const practiceDao = new PracticeDao(tx);

            await practiceDao.insertUserResponse(draft.response);

            for (const evidence of draft.evidence) {
                await practiceDao.insertLearningEvidence(evidence);
            }
        });
    }

    async recordEvaluatedResponse(
        draft: EvaluatedPracticeResponseDraft
    ): Promise<void> {
        await runWriteTransaction(this.db, async (tx) => {
            const practiceDao = new PracticeDao(tx);
            const targetDao = new LearningTargetDao(tx);

            await practiceDao.insertUserResponse(draft.response);

            for (const evidence of draft.evidence) {
                await practiceDao.insertLearningEvidence(evidence);
            }

            for (const target of draft.targetUpdates) {
                await targetDao.upsert(target);
            }
        });
    }
}
