import type { SQLiteDatabase } from "expo-sqlite";

import { KnowledgePracticeSourceService } from "@/services/knowledge-practice/knowledge-practice-source-service";
import { LearningTargetGenerationService } from "@/services/knowledge-practice/learning-target-generation-service";
import { PracticeItemContentGenerationService } from "@/services/knowledge-practice/practice-item-content-generation-service";
import { PracticeItemGenerationService } from "@/services/knowledge-practice/practice-item-generation-service";
import { PracticeResponseEvaluationService } from "@/services/knowledge-practice/practice-response-evaluation-service";

import { AppSettingsRepository } from "./app-settings.repository";
import { ChatSessionRepository } from "./chat-session.repository";
import { KnowledgeRepository } from "./knowledge.repository";
import { PracticeRepository } from "./practice.repository";

export type LanguageFrictionRepositories = {
    appSettings: AppSettingsRepository;
    chatSession: ChatSessionRepository;
    knowledge: KnowledgeRepository;
    practice: PracticeRepository;
    knowledgePracticeSource: KnowledgePracticeSourceService;
    learningTargetGeneration: LearningTargetGenerationService;
    practiceItemContentGeneration: PracticeItemContentGenerationService;
    practiceItemGeneration: PracticeItemGenerationService;
    practiceResponseEvaluation: PracticeResponseEvaluationService;
};

const registries = new WeakMap<SQLiteDatabase, LanguageFrictionRepositories>();

function createLanguageFrictionRepositories(
    db: SQLiteDatabase
): LanguageFrictionRepositories {
    const appSettings = new AppSettingsRepository(db);
    const chatSession = new ChatSessionRepository(db);
    const knowledge = new KnowledgeRepository(db);
    const practice = new PracticeRepository(db);
    const knowledgePracticeSource = new KnowledgePracticeSourceService(db, {
        practiceRepository: practice,
    });
    const learningTargetGeneration = new LearningTargetGenerationService({
        sourceService: knowledgePracticeSource,
        practiceRepository: practice,
    });
    const practiceItemContentGeneration =
        new PracticeItemContentGenerationService();
    const practiceItemGeneration = new PracticeItemGenerationService({
        sourceService: knowledgePracticeSource,
        practiceRepository: practice,
        contentGenerationService: practiceItemContentGeneration,
    });
    const practiceResponseEvaluation = new PracticeResponseEvaluationService({
        practiceRepository: practice,
    });

    return Object.freeze({
        appSettings,
        chatSession,
        knowledge,
        practice,
        knowledgePracticeSource,
        learningTargetGeneration,
        practiceItemContentGeneration,
        practiceItemGeneration,
        practiceResponseEvaluation,
    });
}

export function getLanguageFrictionRepositories(
    db: SQLiteDatabase
): LanguageFrictionRepositories {
    const existingRegistry = registries.get(db);

    if (existingRegistry) {
        return existingRegistry;
    }

    const registry = createLanguageFrictionRepositories(db);
    registries.set(db, registry);

    return registry;
}
