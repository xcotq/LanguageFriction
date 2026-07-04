import {
    PracticeRepository,
    type LearningTargetWithEntities,
    type PracticeItemDraft,
} from "@/data/repositories/practice.repository";
import type {
    Expression,
    KnowledgePointUtterance,
    LearningTarget,
    LearningTargetEntity,
    PracticeItem,
} from "@/types/domain";

import { KnowledgePracticeSourceService } from "./knowledge-practice-source-service";
import type { KnowledgePointPracticeSource } from "./types";

type PracticeItemGenerationServiceDependencies = {
    sourceService: KnowledgePracticeSourceService;
    practiceRepository: PracticeRepository;
};

function formatPracticeTimestamp(date: Date) {
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

function createPracticeItemId(
    target: LearningTarget,
    practiceType: string,
    now: Date,
    index: number
) {
    return `pi:${target.id}:${practiceType}:${formatPracticeTimestamp(now)}:${index}`;
}

function targetDueTime(target: LearningTarget) {
    return target.dueAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

function compareTargetPriority(
    left: LearningTargetWithEntities,
    right: LearningTargetWithEntities
) {
    return (
        targetDueTime(left.target) - targetDueTime(right.target) ||
        right.target.lapseCount - left.target.lapseCount ||
        right.target.priority - left.target.priority ||
        left.target.reviewCount - right.target.reviewCount
    );
}

function isEligibleTarget(
    target: LearningTarget,
    now: Date,
    allowEarlyPractice: boolean
) {
    if (target.status !== "active") {
        return false;
    }

    if (allowEarlyPractice) {
        return true;
    }

    return !target.dueAt || target.dueAt <= now;
}

function limitPracticeTargets(
    targets: LearningTargetWithEntities[],
    limit: number
) {
    const selectedTargets: LearningTargetWithEntities[] = [];
    const expressionTarget = targets.find(
        (record) =>
            record.target.ability === "recall" &&
            Boolean(
                findTargetEntity(record, {
                    entityType: "expression",
                    role: "primary",
                })
            )
    );
    const utteranceTarget = targets.find(
        (record) =>
            record.target.ability === "contextual_production" &&
            Boolean(
                findTargetEntity(record, {
                    entityType: "utterance",
                    role: "primary",
                })
            )
    );

    if (expressionTarget) {
        selectedTargets.push(expressionTarget);
    }

    if (utteranceTarget) {
        selectedTargets.push(utteranceTarget);
    }

    return selectedTargets.slice(0, limit);
}

function findTargetEntity(
    target: LearningTargetWithEntities,
    input: Pick<LearningTargetEntity, "entityType" | "role">
) {
    return target.entities.find(
        (entity) =>
            entity.entityType === input.entityType && entity.role === input.role
    );
}

function uniqueNonEmpty(values: (string | undefined)[]) {
    return [...new Set(values.map((value) => value?.trim()).filter(Boolean))];
}

function createExpressionMap(source: KnowledgePointPracticeSource) {
    return new Map(
        source.expressions.map(({ expression }) => [expression.id, expression])
    );
}

function createUtteranceMap(source: KnowledgePointPracticeSource) {
    return new Map(
        source.utterances.map((utterance) => [utterance.id, utterance])
    );
}

function buildExpressionPracticeItem(input: {
    source: KnowledgePointPracticeSource;
    target: LearningTargetWithEntities;
    expression: Expression;
    now: Date;
    index: number;
}): PracticeItemDraft {
    const { source, target, expression, now, index } = input;
    const prompt = {
        kind: "expression_recall",
        instruction: "How would you express this part in the target language?",
        sourceNeed: source.inquiry.userNeed,
        context: source.knowledgePoint.contextSnapshot,
        clue:
            expression.meaningNote ??
            expression.usageNote ??
            source.knowledgePoint.objective,
        targetLanguage: expression.language,
    };
    const item: PracticeItem = {
        id: createPracticeItemId(
            target.target,
            "expression_recall",
            now,
            index
        ),
        type: "free_response",
        prompt,
        expectedAnswer: {
            expressionId: expression.id,
            text: expression.text,
            normalizedText: expression.normalizedText,
            language: expression.language,
        },
        acceptableAnswers: uniqueNonEmpty([
            expression.text,
            expression.normalizedText,
        ]),
        contextSnapshot: {
            knowledgePointId: source.knowledgePoint.id,
            inquiryId: source.inquiry.id,
            kind: "expression_recall",
            context: source.knowledgePoint.contextSnapshot,
        },
        generatedAt: now,
    };

    return {
        item,
        targets: [
            {
                practiceItemId: item.id,
                learningTargetId: target.target.id,
                weight: 1,
            },
        ],
    };
}

function buildUtterancePracticeItem(input: {
    source: KnowledgePointPracticeSource;
    target: LearningTargetWithEntities;
    utterance: KnowledgePointUtterance;
    now: Date;
    index: number;
}): PracticeItemDraft | null {
    const { source, target, utterance, now, index } = input;

    const requiredExpressionIds = target.entities
        .filter(
            (entity) =>
                entity.entityType === "expression" && entity.role === "required"
        )
        .map((entity) => entity.entityId);
    const prompt = {
        kind: "utterance_production",
        instruction: "Produce the full expression for this situation.",
        sourceNeed: source.inquiry.userNeed,
        objective: source.knowledgePoint.objective,
        context: source.knowledgePoint.contextSnapshot,
        targetLanguage: utterance.language,
        requiredExpressionIds,
    };
    const item: PracticeItem = {
        id: createPracticeItemId(
            target.target,
            "utterance_production",
            now,
            index
        ),
        type: "scenario_response",
        prompt,
        expectedAnswer: {
            utteranceId: utterance.id,
            text: utterance.text,
            language: utterance.language,
        },
        acceptableAnswers: [utterance.text],
        contextSnapshot: {
            knowledgePointId: source.knowledgePoint.id,
            inquiryId: source.inquiry.id,
            kind: "utterance_production",
            context: source.knowledgePoint.contextSnapshot,
        },
        generatedAt: now,
    };

    return {
        item,
        targets: [
            {
                practiceItemId: item.id,
                learningTargetId: target.target.id,
                weight: 1,
            },
        ],
    };
}

export class PracticeItemGenerationService {
    private readonly sourceService: KnowledgePracticeSourceService;
    private readonly practiceRepository: PracticeRepository;

    constructor(dependencies: PracticeItemGenerationServiceDependencies) {
        this.sourceService = dependencies.sourceService;
        this.practiceRepository = dependencies.practiceRepository;
    }

    async generateForLearningTarget(input: {
        userId: string;
        learningTargetId: string;
        now?: Date;
        allowEarlyPractice?: boolean;
    }): Promise<PracticeItemDraft | null> {
        const drafts = await this.generateForLearningTargets({
            userId: input.userId,
            learningTargetIds: [input.learningTargetId],
            now: input.now,
            allowEarlyPractice: input.allowEarlyPractice,
            limit: 1,
        });

        return drafts[0] ?? null;
    }

    async generateForLearningTargets(input: {
        userId: string;
        learningTargetIds: string[];
        now?: Date;
        allowEarlyPractice?: boolean;
        limit?: number;
    }): Promise<PracticeItemDraft[]> {
        const now = input.now ?? new Date();
        const targetRecords = (
            await Promise.all(
                input.learningTargetIds.map((learningTargetId) =>
                    this.practiceRepository.getLearningTargetWithEntities(
                        learningTargetId,
                        input.userId
                    )
                )
            )
        ).filter((record): record is LearningTargetWithEntities =>
            Boolean(record)
        );
        const eligibleTargets = targetRecords
            .filter(({ target }) =>
                isEligibleTarget(target, now, input.allowEarlyPractice ?? false)
            )
            .sort(compareTargetPriority);
        const drafts = await this.materializeLearningTargets({
            userId: input.userId,
            targets: eligibleTargets,
            now,
            limit: input.limit ?? eligibleTargets.length,
        });

        await this.practiceRepository.savePracticeItems(drafts);

        return drafts;
    }

    async generateForKnowledgePoint(input: {
        userId: string;
        knowledgePointId: string;
        now?: Date;
        allowEarlyPractice?: boolean;
        limit?: number;
    }): Promise<PracticeItemDraft[]> {
        const now = input.now ?? new Date();
        const source = await this.sourceService.getSource(
            input.knowledgePointId,
            input.userId
        );

        if (!source) {
            return [];
        }

        const targetRecords =
            await this.practiceRepository.listLearningTargetsForKnowledgePoint(
                input.userId,
                input.knowledgePointId
            );
        const eligibleTargets = targetRecords
            .filter(({ target }) =>
                isEligibleTarget(target, now, input.allowEarlyPractice ?? false)
            )
            .sort(compareTargetPriority);
        const selectedTargets = limitPracticeTargets(
            eligibleTargets,
            input.limit ?? 2
        );
        const drafts = this.materializeLearningTargetsWithSource({
            source,
            targets: selectedTargets,
            now,
        });

        await this.practiceRepository.savePracticeItems(drafts);

        return drafts;
    }

    private async materializeLearningTargets(input: {
        userId: string;
        targets: LearningTargetWithEntities[];
        now: Date;
        limit: number;
    }) {
        const drafts: PracticeItemDraft[] = [];
        const sourceByKnowledgePointId = new Map<
            string,
            KnowledgePointPracticeSource | null
        >();

        for (const target of input.targets) {
            if (drafts.length >= input.limit) {
                break;
            }

            const knowledgePointId = target.target.knowledgePointId;

            if (!knowledgePointId) {
                continue;
            }

            if (!sourceByKnowledgePointId.has(knowledgePointId)) {
                sourceByKnowledgePointId.set(
                    knowledgePointId,
                    await this.sourceService.getSource(
                        knowledgePointId,
                        input.userId
                    )
                );
            }

            const source = sourceByKnowledgePointId.get(knowledgePointId);

            if (!source) {
                continue;
            }

            const draft = this.materializeLearningTargetWithSource({
                source,
                target,
                now: input.now,
                index: drafts.length,
            });

            if (draft) {
                drafts.push(draft);
            }
        }

        return drafts;
    }

    private materializeLearningTargetsWithSource(input: {
        source: KnowledgePointPracticeSource;
        targets: LearningTargetWithEntities[];
        now: Date;
    }) {
        return input.targets
            .map((target, index) =>
                this.materializeLearningTargetWithSource({
                    source: input.source,
                    target,
                    now: input.now,
                    index,
                })
            )
            .filter((draft): draft is PracticeItemDraft => Boolean(draft));
    }

    private materializeLearningTargetWithSource(input: {
        source: KnowledgePointPracticeSource;
        target: LearningTargetWithEntities;
        now: Date;
        index: number;
    }) {
        const { source, target, now, index } = input;
        const expressionById = createExpressionMap(source);
        const utteranceById = createUtteranceMap(source);

        switch (target.target.ability) {
            case "recall":
                return this.createExpressionDraft(
                    source,
                    target,
                    expressionById,
                    now,
                    index
                );
            case "contextual_production":
                return this.createUtteranceDraft(
                    source,
                    target,
                    utteranceById,
                    now,
                    index
                );
            default:
                return null;
        }
    }

    private createExpressionDraft(
        source: KnowledgePointPracticeSource,
        target: LearningTargetWithEntities,
        expressionById: Map<string, Expression>,
        now: Date,
        index: number
    ) {
        const primaryEntity = findTargetEntity(target, {
            entityType: "expression",
            role: "primary",
        });
        const expression = primaryEntity
            ? expressionById.get(primaryEntity.entityId)
            : undefined;

        if (!expression) {
            return null;
        }

        return buildExpressionPracticeItem({
            source,
            target,
            expression,
            now,
            index,
        });
    }

    private createUtteranceDraft(
        source: KnowledgePointPracticeSource,
        target: LearningTargetWithEntities,
        utteranceById: Map<string, KnowledgePointUtterance>,
        now: Date,
        index: number
    ) {
        const primaryEntity = findTargetEntity(target, {
            entityType: "utterance",
            role: "primary",
        });
        const utterance = primaryEntity
            ? utteranceById.get(primaryEntity.entityId)
            : undefined;

        if (!utterance) {
            return null;
        }

        return buildUtterancePracticeItem({
            source,
            target,
            utterance,
            now,
            index,
        });
    }
}
