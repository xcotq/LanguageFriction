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
