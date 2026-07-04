import { PracticeRepository } from "@/data/repositories/practice.repository";
import type {
    Expression,
    KnowledgePointEntityRole,
    KnowledgePointUtterance,
    LearningDifficulty,
    LearningTarget,
    LearningTargetEntity,
} from "@/types/domain";

import { KnowledgePracticeSourceService } from "./knowledge-practice-source-service";
import type {
    KnowledgePointExpressionSource,
    KnowledgePointPracticeSource,
} from "./types";

type LearningTargetGenerationServiceDependencies = {
    sourceService: KnowledgePracticeSourceService;
    practiceRepository: PracticeRepository;
};

export type LearningTargetGenerationResult = {
    targets: LearningTarget[];
    entities: LearningTargetEntity[];
};

const SCHEDULING_ALGORITHM = "lf-exponential";
const SCHEDULING_VERSION = "0.1";

const INITIAL_STABILITY_DAYS: Record<LearningDifficulty, number> = {
    low: 2,
    medium: 1,
    high: 0.5,
};

const TRAINABLE_EXPRESSION_ROLES = new Set<KnowledgePointEntityRole>([
    "primary",
    "derived",
    "supporting",
]);

function expressionTargetId(knowledgePointId: string, expressionId: string) {
    return `lt:kp:${knowledgePointId}:expr:${expressionId}:recall`;
}

function utteranceTargetId(knowledgePointId: string, utteranceId: string) {
    return `lt:kp:${knowledgePointId}:utt:${utteranceId}:contextual_production`;
}

function expressionPriority(role: KnowledgePointEntityRole) {
    switch (role) {
        case "primary":
            return 80;
        case "derived":
            return 70;
        case "supporting":
            return 60;
        default:
            return 40;
    }
}

function initialStability(difficulty: LearningDifficulty) {
    return INITIAL_STABILITY_DAYS[difficulty];
}

function inferExpressionDifficulty(expression: Expression): LearningDifficulty {
    const text = expression.text.trim();

    if (!text) {
        return "medium";
    }

    const tokens = text.split(/\s+/).filter(Boolean);
    const hasComplexPunctuation = /[{}\[\]()\/?!,.;:]/.test(text);

    if (tokens.length >= 5 || hasComplexPunctuation) {
        return "high";
    }

    if (tokens.length === 1 && text.length <= 16) {
        return "low";
    }

    return "medium";
}

function inferUtteranceDifficulty(
    utterance: KnowledgePointUtterance
): LearningDifficulty {
    const wordCount = utterance.text.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount === 0) {
        return "medium";
    }

    return wordCount <= 8 ? "medium" : "high";
}

function createTargetBase(input: {
    id: string;
    userId: string;
    knowledgePointId: string;
    ability: LearningTarget["ability"];
    priority: number;
    difficulty: LearningDifficulty;
    now: Date;
}): LearningTarget {
    return {
        id: input.id,
        userId: input.userId,
        knowledgePointId: input.knowledgePointId,
        ability: input.ability,
        status: "active",
        priority: input.priority,
        difficulty: input.difficulty,
        stability: initialStability(input.difficulty),
        dueAt: input.now,
        reviewCount: 0,
        lapseCount: 0,
        schedulingAlgorithm: SCHEDULING_ALGORITHM,
        schedulingVersion: SCHEDULING_VERSION,
        createdAt: input.now,
        updatedAt: input.now,
    };
}

function preserveExistingMastery(
    draft: LearningTarget,
    existing?: LearningTarget
): LearningTarget {
    if (!existing) {
        return draft;
    }

    return {
        ...draft,
        status: existing.status,
        stability: existing.stability ?? draft.stability,
        dueAt: existing.dueAt ?? draft.dueAt,
        lastReviewedAt: existing.lastReviewedAt,
        reviewCount: existing.reviewCount,
        lapseCount: existing.lapseCount,
        createdAt: existing.createdAt,
    };
}

function dedupeTargetEntities(entities: LearningTargetEntity[]) {
    const deduped = new Map<string, LearningTargetEntity>();

    for (const entity of entities) {
        deduped.set(
            [
                entity.learningTargetId,
                entity.entityType,
                entity.entityId,
                entity.role,
            ].join("|"),
            entity
        );
    }

    return [...deduped.values()];
}

function isTrainableExpression(source: KnowledgePointExpressionSource) {
    return TRAINABLE_EXPRESSION_ROLES.has(source.link.role);
}

function createExpressionTargetDraft(input: {
    source: KnowledgePointPracticeSource;
    expressionSource: KnowledgePointExpressionSource;
    userId: string;
    now: Date;
    existing?: LearningTarget;
}) {
    const { source, expressionSource, userId, now } = input;
    const knowledgePointId = source.knowledgePoint.id;
    const target = preserveExistingMastery(
        createTargetBase({
            id: expressionTargetId(
                knowledgePointId,
                expressionSource.expression.id
            ),
            userId,
            knowledgePointId,
            ability: "recall",
            priority: expressionPriority(expressionSource.link.role),
            difficulty: inferExpressionDifficulty(expressionSource.expression),
            now,
        }),
        input.existing
    );
    const entities: LearningTargetEntity[] = [
        {
            learningTargetId: target.id,
            entityType: "expression",
            entityId: expressionSource.expression.id,
            role: "primary",
        },
    ];

    if (source.utterance) {
        entities.push({
            learningTargetId: target.id,
            entityType: "utterance",
            entityId: source.utterance.id,
            role: "supporting",
        });
    }

    return { target, entities };
}

function createUtteranceTargetDraft(input: {
    source: KnowledgePointPracticeSource;
    trainableExpressions: KnowledgePointExpressionSource[];
    userId: string;
    now: Date;
    existing?: LearningTarget;
}) {
    const { source, trainableExpressions, userId, now } = input;

    if (!source.utterance) {
        return null;
    }

    const knowledgePointId = source.knowledgePoint.id;
    const target = preserveExistingMastery(
        createTargetBase({
            id: utteranceTargetId(knowledgePointId, source.utterance.id),
            userId,
            knowledgePointId,
            ability: "contextual_production",
            priority: 90,
            difficulty: inferUtteranceDifficulty(source.utterance),
            now,
        }),
        input.existing
    );
    const entities: LearningTargetEntity[] = [
        {
            learningTargetId: target.id,
            entityType: "utterance",
            entityId: source.utterance.id,
            role: "primary",
        },
        ...trainableExpressions.map<LearningTargetEntity>(({ expression }) => ({
            learningTargetId: target.id,
            entityType: "expression",
            entityId: expression.id,
            role: "required",
        })),
    ];

    return { target, entities: dedupeTargetEntities(entities) };
}

export class LearningTargetGenerationService {
    private readonly sourceService: KnowledgePracticeSourceService;
    private readonly practiceRepository: PracticeRepository;

    constructor(dependencies: LearningTargetGenerationServiceDependencies) {
        this.sourceService = dependencies.sourceService;
        this.practiceRepository = dependencies.practiceRepository;
    }

    async generateForKnowledgePoint(input: {
        userId: string;
        knowledgePointId: string;
        now?: Date;
    }): Promise<LearningTargetGenerationResult> {
        const now = input.now ?? new Date();
        const source = await this.sourceService.getSource(
            input.knowledgePointId,
            input.userId
        );

        if (!source) {
            return { targets: [], entities: [] };
        }

        const existingTargets =
            await this.practiceRepository.listLearningTargetsForKnowledgePoint(
                input.userId,
                input.knowledgePointId
            );
        const existingTargetsById = new Map(
            existingTargets.map(({ target }) => [target.id, target])
        );
        const trainableExpressions = source.expressions.filter(
            isTrainableExpression
        );
        const drafts = [
            ...trainableExpressions.map((expressionSource) =>
                createExpressionTargetDraft({
                    source,
                    expressionSource,
                    userId: input.userId,
                    now,
                    existing: existingTargetsById.get(
                        expressionTargetId(
                            input.knowledgePointId,
                            expressionSource.expression.id
                        )
                    ),
                })
            ),
        ];
        const utteranceDraft = createUtteranceTargetDraft({
            source,
            trainableExpressions,
            userId: input.userId,
            now,
            existing: source.utterance
                ? existingTargetsById.get(
                      utteranceTargetId(
                          input.knowledgePointId,
                          source.utterance.id
                      )
                  )
                : undefined,
        });

        if (utteranceDraft) {
            drafts.push(utteranceDraft);
        }

        await this.practiceRepository.saveLearningTargets(drafts);

        return {
            targets: drafts.map(({ target }) => target),
            entities: drafts.flatMap(({ entities }) => entities),
        };
    }
}
