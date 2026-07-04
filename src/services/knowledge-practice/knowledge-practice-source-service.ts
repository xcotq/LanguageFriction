import type { SQLiteDatabase } from "expo-sqlite";

import { SessionDao } from "@/data/dao/raw.dao";
import {
    InquiryDao,
    KnowledgeEntityDao,
    KnowledgePointDao,
} from "@/data/dao/knowledge.dao";
import { PracticeRepository } from "@/data/repositories/practice.repository";
import type {
    Inquiry,
    KnowledgePoint,
    KnowledgePointEntity,
    KnowledgePointUtterance,
} from "@/types/domain";

import type {
    KnowledgePointExpressionSource,
    KnowledgePointPracticeSource,
    KnowledgePointSummary,
} from "./types";

type KnowledgePracticeSourceServiceDependencies = {
    practiceRepository: PracticeRepository;
};

function selectPreferredUtterance(utterances: KnowledgePointUtterance[]) {
    return (
        utterances.find((utterance) => utterance.role === "recommended") ??
        utterances[0]
    );
}

function isExpressionLink(link: KnowledgePointEntity) {
    return link.entityType === "expression";
}

export class KnowledgePracticeSourceService {
    private readonly sessionDao: SessionDao;
    private readonly inquiryDao: InquiryDao;
    private readonly knowledgePointDao: KnowledgePointDao;
    private readonly entityDao: KnowledgeEntityDao;
    private readonly practiceRepository: PracticeRepository;

    constructor(
        db: SQLiteDatabase,
        dependencies: KnowledgePracticeSourceServiceDependencies
    ) {
        this.sessionDao = new SessionDao(db);
        this.inquiryDao = new InquiryDao(db);
        this.knowledgePointDao = new KnowledgePointDao(db);
        this.entityDao = new KnowledgeEntityDao(db);
        this.practiceRepository = dependencies.practiceRepository;
    }

    async getSource(
        knowledgePointId: string,
        userId: string
    ): Promise<KnowledgePointPracticeSource | null> {
        const knowledgePoint =
            await this.knowledgePointDao.getById(knowledgePointId);

        if (!knowledgePoint) {
            return null;
        }

        const inquiry = await this.inquiryDao.getById(knowledgePoint.inquiryId);

        if (!inquiry) {
            return null;
        }

        const session = await this.sessionDao.getById(inquiry.sessionId);

        if (!session || session.userId !== userId) {
            return null;
        }

        return this.createSource(knowledgePoint, inquiry);
    }

    async listKnowledgePoints(
        userId: string
    ): Promise<KnowledgePointSummary[]> {
        const sessions = await this.sessionDao.listByUser(userId, 100);
        const summaries: KnowledgePointSummary[] = [];

        for (const session of sessions) {
            const inquiries = await this.inquiryDao.listBySessionId(session.id);

            for (const inquiry of inquiries) {
                const knowledgePoints =
                    await this.knowledgePointDao.listByInquiryId(inquiry.id);

                for (const knowledgePoint of knowledgePoints) {
                    if (knowledgePoint.status !== "active") {
                        continue;
                    }

                    summaries.push(
                        await this.createSummary(
                            knowledgePoint,
                            inquiry,
                            session.userId
                        )
                    );
                }
            }
        }

        return summaries.sort(
            (left, right) =>
                right.knowledgePoint.updatedAt.getTime() -
                left.knowledgePoint.updatedAt.getTime()
        );
    }

    async getSummary(
        knowledgePointId: string,
        userId: string
    ): Promise<KnowledgePointSummary | null> {
        const source = await this.getSource(knowledgePointId, userId);

        if (!source) {
            return null;
        }

        return this.createSummary(
            source.knowledgePoint,
            source.inquiry,
            userId
        );
    }

    private async createSource(
        knowledgePoint: KnowledgePoint,
        inquiry: Inquiry
    ): Promise<KnowledgePointPracticeSource> {
        const [utterances, links] = await Promise.all([
            this.knowledgePointDao.listUtterances(knowledgePoint.id),
            this.knowledgePointDao.listEntities(knowledgePoint.id),
        ]);
        const expressionLinks = links.filter(isExpressionLink);
        const expressions = await this.entityDao.getExpressionsByIds(
            expressionLinks.map((link) => link.entityId)
        );
        const expressionsById = new Map(
            expressions.map((expression) => [expression.id, expression])
        );

        return {
            knowledgePoint,
            inquiry,
            utterance: selectPreferredUtterance(utterances),
            utterances,
            expressions:
                expressionLinks.flatMap<KnowledgePointExpressionSource>(
                    (link) => {
                        const expression = expressionsById.get(link.entityId);

                        return expression ? [{ expression, link }] : [];
                    }
                ),
        };
    }

    private async createSummary(
        knowledgePoint: KnowledgePoint,
        inquiry: Inquiry,
        userId: string
    ): Promise<KnowledgePointSummary> {
        const [utterances, links, targets] = await Promise.all([
            this.knowledgePointDao.listUtterances(knowledgePoint.id),
            this.knowledgePointDao.listEntities(knowledgePoint.id),
            this.practiceRepository.listLearningTargetsForKnowledgePoint(
                userId,
                knowledgePoint.id
            ),
        ]);
        const stats =
            await this.practiceRepository.getPracticeStatsForLearningTargets(
                targets.map(({ target }) => target.id)
            );
        const now = new Date();
        const dueTargetCount = targets.filter(({ target }) => {
            return (
                target.status === "active" &&
                (!target.dueAt || target.dueAt <= now)
            );
        }).length;

        return {
            knowledgePoint,
            inquiry,
            utterance: selectPreferredUtterance(utterances),
            expressionCount: links.filter(isExpressionLink).length,
            dueTargetCount,
            targetCount: targets.length,
            practiceItemCount: stats.count,
            latestPracticeGeneratedAt: stats.latestGeneratedAt,
        };
    }
}
