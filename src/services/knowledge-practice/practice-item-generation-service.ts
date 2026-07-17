import {
    PracticeRepository,
    type LearningTargetWithEntities,
    type PracticeItemDraft,
} from "@/data/repositories/practice.repository";
import type { LearningTarget, PracticeItem } from "@/types/domain";

import { KnowledgePracticeSourceService } from "./knowledge-practice-source-service";
import { PracticeItemContentGenerationService } from "./practice-item-content-generation-service";
import type { KnowledgePointPracticeSource } from "./types";

type PracticeItemGenerationServiceDependencies = {
    sourceService: KnowledgePracticeSourceService;
    practiceRepository: PracticeRepository;
    contentGenerationService?: PracticeItemContentGenerationService;
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

export class PracticeItemGenerationService {
    private readonly sourceService: KnowledgePracticeSourceService;
    private readonly practiceRepository: PracticeRepository;
    private readonly contentGenerationService: PracticeItemContentGenerationService;

    constructor(dependencies: PracticeItemGenerationServiceDependencies) {
        this.sourceService = dependencies.sourceService;
        this.practiceRepository = dependencies.practiceRepository;
        this.contentGenerationService =
            dependencies.contentGenerationService ??
            new PracticeItemContentGenerationService();
    }

    async generateForLearningTarget(input: {
        userId: string;
        learningTargetId: string;
        now?: Date;
        allowEarlyPractice?: boolean;
    }): Promise<PracticeItemDraft | null> {
        const now = input.now ?? new Date();
        const targetRecord =
            await this.practiceRepository.getLearningTargetWithEntities(
                input.learningTargetId,
                input.userId
            );

        if (
            !targetRecord ||
            !isEligibleTarget(
                targetRecord.target,
                now,
                input.allowEarlyPractice ?? false
            )
        ) {
            return null;
        }

        const draft = await this.materializeLearningTarget({
            userId: input.userId,
            target: targetRecord,
            now,
            index: 0,
        });

        if (!draft) {
            return null;
        }

        await this.practiceRepository.savePracticeItem(draft);

        return draft;
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
            .sort(compareTargetPriority)
            .slice(0, input.limit ?? targetRecords.length);
        const drafts = await this.materializeLearningTargets({
            userId: input.userId,
            targets: eligibleTargets,
            now,
        });

        await this.practiceRepository.savePracticeItems(drafts);

        return drafts;
    }

    private async materializeLearningTargets(input: {
        userId: string;
        targets: LearningTargetWithEntities[];
        now: Date;
    }) {
        const drafts: PracticeItemDraft[] = [];
        const sourceByKnowledgePointId = new Map<
            string,
            KnowledgePointPracticeSource | null
        >();

        for (const target of input.targets) {
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

            const draft = await this.materializeLearningTargetWithSource({
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

    private async materializeLearningTarget(input: {
        userId: string;
        target: LearningTargetWithEntities;
        now: Date;
        index: number;
    }) {
        const knowledgePointId = input.target.target.knowledgePointId;

        if (!knowledgePointId) {
            return null;
        }

        const source = await this.sourceService.getSource(
            knowledgePointId,
            input.userId
        );

        if (!source) {
            return null;
        }

        return this.materializeLearningTargetWithSource({
            source,
            target: input.target,
            now: input.now,
            index: input.index,
        });
    }

    private async materializeLearningTargetWithSource(input: {
        source: KnowledgePointPracticeSource;
        target: LearningTargetWithEntities;
        now: Date;
        index: number;
    }): Promise<PracticeItemDraft> {
        const { source, target, now, index } = input;
        const generatedContent =
            await this.contentGenerationService.generateForTarget({
                source,
                target,
            });
        const practiceType = target.target.ability;
        const item: PracticeItem = {
            id: createPracticeItemId(target.target, practiceType, now, index),
            type: "free_response",
            prompt: generatedContent.prompt,
            expectedAnswer: generatedContent.expectedAnswer,
            acceptableAnswers: generatedContent.acceptableAnswers,
            contextSnapshot: {
                knowledgePointId: source.knowledgePoint.id,
                inquiryId: source.inquiry.id,
                learningTargetId: target.target.id,
                kind: practiceType,
                itemType: "free_response",
                generatedBy: "llm",
                context: source.knowledgePoint.contextSnapshot,
                targetEntities: target.entities,
            },
            generatedAt: now,
        };
        const draft: PracticeItemDraft = {
            item,
            targets: [
                {
                    practiceItemId: item.id,
                    learningTargetId: target.target.id,
                    weight: 1,
                },
            ],
        };

        console.log("[LanguageFriction][learningTarget=>practiceItem][llm]", {
            knowledgePointId: source.knowledgePoint.id,
            inquiryId: source.inquiry.id,
            learningTargetId: target.target.id,
            output: draft,
        });

        return draft;
    }
}
