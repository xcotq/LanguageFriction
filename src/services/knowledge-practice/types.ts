import type {
    Expression,
    Inquiry,
    KnowledgePoint,
    KnowledgePointEntity,
    KnowledgePointUtterance,
} from "@/types/domain";

export type KnowledgePointExpressionSource = {
    expression: Expression;
    link: KnowledgePointEntity;
};

export type KnowledgePointPracticeSource = {
    knowledgePoint: KnowledgePoint;
    inquiry: Inquiry;
    utterance?: KnowledgePointUtterance;
    utterances: KnowledgePointUtterance[];
    expressions: KnowledgePointExpressionSource[];
};

export type KnowledgePointSummary = {
    knowledgePoint: KnowledgePoint;
    inquiry: Inquiry;
    utterance?: KnowledgePointUtterance;
    expressionCount: number;
    dueTargetCount: number;
    targetCount: number;
    practiceItemCount: number;
    latestPracticeGeneratedAt?: Date;
};
