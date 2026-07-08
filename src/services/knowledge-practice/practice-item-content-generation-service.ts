import { jsonSchema } from "ai";

import type { StructuredOutputOptions } from "@/providers/language-model-provider";
import {
    languageModelService,
    type LanguageModelService,
} from "@/services/llm/language-model-service";
import type {
    Concept,
    Expression,
    KnowledgePointUtterance,
    LearningAbility,
    LearningTargetEntity,
} from "@/types/domain";
import type { LearningTargetWithEntities } from "@/data/repositories/practice.repository";

import type { KnowledgePointPracticeSource } from "./types";

export type GeneratedPracticePrompt = {
    title: string;
    markdown: string;
};

export type GeneratedPracticeExpectedAnswer = {
    text: string;
    explanation: string;
    requiredElements: string[];
    commonPitfalls: string[];
};

export type PracticeItemContentGenerationOutput = {
    prompt: GeneratedPracticePrompt;
    expectedAnswer: GeneratedPracticeExpectedAnswer;
    acceptableAnswers: string[];
};

type PracticeItemContentGenerationServiceDependencies = {
    modelService?: LanguageModelService;
};

const PRACTICE_ITEM_CONTENT_GENERATION_PROMPT_OPTIONS = {
    name: "PracticeItemContentGeneration",
    description:
        "Generate a persisted free-response language practice item for one learning target.",
} satisfies StructuredOutputOptions;

const practiceItemContentGenerationSchema =
    jsonSchema<PracticeItemContentGenerationOutput>({
        type: "object",
        description:
            "Complete generated practice item content to persist for one free-response learning exercise.",
        properties: {
            prompt: {
                type: "object",
                description:
                    "Learner-facing prompt payload. It must contain every display element needed to render the exercise later.",
                properties: {
                    title: {
                        type: "string",
                        description:
                            "Short plain-text summary title for lists and headers. The app already displays this outside the Markdown body when needed.",
                    },
                    markdown: {
                        type: "string",
                        description:
                            "One complete learner-facing Markdown prompt body. Include the task instruction, scenario, constraints, and any useful hints. Do not include the answer.",
                    },
                },
                required: ["title", "markdown"],
                additionalProperties: false,
            },
            expectedAnswer: {
                type: "object",
                description:
                    "The canonical answer generated for this exact materialized prompt.",
                properties: {
                    text: {
                        type: "string",
                        description: "Canonical answer text for the prompt.",
                    },
                    explanation: {
                        type: "string",
                        description:
                            "Brief explanation of why this answer satisfies the target.",
                    },
                    requiredElements: {
                        type: "array",
                        description:
                            "Required meaning, wording, register, or usage elements that a correct answer should include.",
                        items: { type: "string" },
                    },
                    commonPitfalls: {
                        type: "array",
                        description:
                            "Likely mistakes or confusions for this prompt.",
                        items: { type: "string" },
                    },
                },
                required: [
                    "text",
                    "explanation",
                    "requiredElements",
                    "commonPitfalls",
                ],
                additionalProperties: false,
            },
            acceptableAnswers: {
                type: "array",
                description:
                    "Natural answer variants that should be accepted for this exact prompt.",
                items: { type: "string" },
            },
        },
        required: ["prompt", "expectedAnswer", "acceptableAnswers"],
        additionalProperties: false,
    });

const PRACTICE_ITEM_GENERATION_SYSTEM_PROMPT = [
    "You generate one persisted language-learning practice item for one learning target.",
    "The practice item will be stored immediately, so prompt.markdown must contain every learner-facing display element needed later.",
    "Generate prompt, expectedAnswer, and acceptableAnswers together. Do not rely on hidden context after generation.",
    "The hosting app already knows the practice type, answer mode, and language metadata. Do not include those as generated fields.",
    "Do not create multiple-choice, flashcard-only, or translation UI assumptions.",
    "Write prompt.markdown as one coherent Markdown block. prompt.title is only a short summary; the Markdown body is the complete visible prompt. Do not invent external URLs or binary assets.",
    "Use only the source details explicitly provided in the request. Do not infer from omitted knowledge entities.",
    "Do not expose internal ids to the learner.",
    "Keep the exercise compact, concrete, and answerable. Prefer one focused prompt over a broad lesson.",
    "Return only data that matches the schema.",
].join("\n");

function uniqueNonEmpty(values: (string | null | undefined)[]) {
    return [
        ...new Set(
            values
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value))
        ),
    ];
}

function practiceTypeGuidance(ability: LearningAbility) {
    switch (ability) {
        case "recognition":
            return [
                "Create a free-response recognition exercise.",
                "Show the meaning, situation, or source-language clue and ask the learner to write the target expression or identify what expression is being cued.",
                "The expected answer should be the recognized expression or compact answer.",
            ].join(" ");
        case "recall":
            return [
                "Create a free-response recall exercise.",
                "Cue the meaning and usage context without giving away the exact target expression.",
                "The expected answer should be the target expression the learner should produce.",
            ].join(" ");
        case "contextual_production":
            return [
                "Create a free-response contextual production exercise.",
                "Describe the real-world scenario, speaker/listener roles, register, and constraints.",
                "The expected answer should be a natural full utterance for that scenario.",
            ].join(" ");
        case "transfer":
            return [
                "Create a free-response transfer exercise.",
                "Build a nearby new situation that uses the same useful pattern or knowledge without copying the original utterance exactly.",
                "The expected answer should demonstrate transfer of the pattern or distinction.",
            ].join(" ");
        case "distinction":
            return [
                "Create a free-response distinction exercise.",
                "Make the learner choose or explain the right expression in context by writing an answer, not selecting from options.",
                "The expected answer should make the contrast clear and should mention the correct expression or concept.",
            ].join(" ");
    }
}

function asTargetEntitySet(
    target: LearningTargetWithEntities,
    entityType: LearningTargetEntity["entityType"]
) {
    return new Set(
        target.entities
            .filter((entity) => entity.entityType === entityType)
            .map((entity) => entity.entityId)
    );
}

function targetEntityRole(
    target: LearningTargetWithEntities,
    entityType: LearningTargetEntity["entityType"],
    entityId: string
) {
    return target.entities.find(
        (entity) =>
            entity.entityType === entityType && entity.entityId === entityId
    )?.role;
}

function targetExpressions(input: {
    source: KnowledgePointPracticeSource;
    target: LearningTargetWithEntities;
}) {
    const expressionIds = asTargetEntitySet(input.target, "expression");

    return input.source.expressions.filter(({ expression }) =>
        expressionIds.has(expression.id)
    );
}

function targetConcepts(input: {
    source: KnowledgePointPracticeSource;
    target: LearningTargetWithEntities;
}) {
    const conceptIds = asTargetEntitySet(input.target, "concept");

    return input.source.concepts.filter(({ concept }) =>
        conceptIds.has(concept.id)
    );
}

function targetUtterances(input: {
    source: KnowledgePointPracticeSource;
    target: LearningTargetWithEntities;
}) {
    const utteranceIds = asTargetEntitySet(input.target, "utterance");

    return input.source.utterances.filter((utterance) =>
        utteranceIds.has(utterance.id)
    );
}

function describeOptional(label: string, value?: string | null) {
    const trimmed = value?.trim();

    return trimmed ? `${label}: ${trimmed}` : undefined;
}

function describeStringList(label: string, values?: string[]) {
    const items = uniqueNonEmpty(values ?? []);

    return items.length ? `${label}: ${items.join(", ")}` : undefined;
}

function formatRecordKey(key: string) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
}

function isUsefulContextValue(value: unknown): boolean {
    if (value == null) {
        return false;
    }

    if (typeof value === "string") {
        return Boolean(value.trim());
    }

    if (Array.isArray(value)) {
        return value.some(isUsefulContextValue);
    }

    if (typeof value === "object") {
        return Object.keys(value).length > 0;
    }

    return true;
}

function isUsefulContextKey(key: string) {
    return !/(^id$|id$|uuid|created|updated|status)/i.test(key);
}

function describeContextValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(describeContextValue).filter(Boolean).join(", ");
    }

    if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
            .filter(
                ([key, item]) =>
                    isUsefulContextKey(key) && isUsefulContextValue(item)
            )
            .map(
                ([key, item]) =>
                    `${formatRecordKey(key)} is ${describeContextValue(item)}`
            )
            .join("; ");
    }

    return String(value);
}

function describeContextSnapshot(context: Record<string, unknown>) {
    return Object.entries(context)
        .filter(
            ([key, value]) =>
                isUsefulContextKey(key) && isUsefulContextValue(value)
        )
        .map(
            ([key, value]) =>
                `- ${formatRecordKey(key)}: ${describeContextValue(value)}`
        );
}

function describeConcept(
    concept: Concept,
    role?: LearningTargetEntity["role"] | null
) {
    return uniqueNonEmpty([
        role
            ? `${role} concept: ${concept.canonicalLabel}`
            : concept.canonicalLabel,
        describeOptional("Language hint", concept.languageHint),
        describeOptional("Definition", concept.definition),
        describeStringList("Aliases", concept.aliases),
        describeOptional("Disambiguation", concept.disambiguationNote),
        describeStringList("Domain", concept.domain),
    ]).join("\n  ");
}

function describeExpression(
    expression: Expression,
    role?: LearningTargetEntity["role"] | null
) {
    return uniqueNonEmpty([
        role ? `${role} expression: ${expression.text}` : expression.text,
        describeOptional("Language", expression.language),
        expression.normalizedText !== expression.text
            ? describeOptional("Normalized form", expression.normalizedText)
            : undefined,
        describeOptional("Register", expression.register),
        describeOptional("Region", expression.region),
        describeOptional("Meaning", expression.meaningNote),
        describeOptional("Usage", expression.usageNote),
        describeStringList("Domain", expression.domain),
    ]).join("\n  ");
}

function describeUtterance(utterance: KnowledgePointUtterance) {
    return uniqueNonEmpty([
        `Utterance: ${utterance.text}`,
        describeOptional("Language", utterance.language),
        describeOptional("Role", utterance.role),
        describeOptional("Usage", utterance.usageNote),
    ]).join("\n  ");
}

function appendSection(lines: string[], title: string, items: string[]) {
    const usefulItems = uniqueNonEmpty(items);

    if (!usefulItems.length) {
        return;
    }

    lines.push("", `${title}:`, ...usefulItems.map((item) => `- ${item}`));
}

function createTargetSourceDescription(input: {
    source: KnowledgePointPracticeSource;
    target: LearningTargetWithEntities;
}) {
    const { source, target } = input;
    const utterances = targetUtterances(input);
    const expressions = targetExpressions(input);
    const concepts = targetConcepts(input);
    const lines: string[] = [
        "Generate one free-response language practice item from the following target.",
        "",
        `Practice type: ${target.target.ability}`,
        `Practice guidance: ${practiceTypeGuidance(target.target.ability)}`,
        "The generated prompt.markdown must contain all learner-facing display content.",
        "",
        "Origin background:",
        `- Original learner need: ${source.inquiry.userNeed}`,
        `- Inquiry context: ${source.inquiry.contextSummary}`,
        `- Learner-language background: ${source.inquiry.primaryLanguageContext}`,
        `- Target language: ${source.inquiry.targetLanguage}`,
        `- Knowledge point: ${source.knowledgePoint.title}`,
        `- Learning objective: ${source.knowledgePoint.objective}`,
    ];

    if (source.inquiry.sourceLanguage) {
        lines.push(`- Source language: ${source.inquiry.sourceLanguage}`);
    }

    if (source.knowledgePoint.explanation) {
        lines.push(`- Explanation: ${source.knowledgePoint.explanation}`);
    }

    appendSection(
        lines,
        "Useful scenario constraints",
        describeContextSnapshot(source.knowledgePoint.contextSnapshot)
    );

    appendSection(lines, "Target utterance", utterances.map(describeUtterance));

    appendSection(
        lines,
        target.target.ability === "contextual_production"
            ? "Expressions directly used by this utterance target"
            : "Expressions directly referenced by this target",
        expressions.map(({ expression }) =>
            describeExpression(
                expression,
                targetEntityRole(target, "expression", expression.id)
            )
        )
    );

    appendSection(
        lines,
        target.target.ability === "contextual_production"
            ? "Concepts directly used by this utterance target"
            : "Concepts directly referenced by this target",
        concepts.map(({ concept }) =>
            describeConcept(
                concept,
                targetEntityRole(target, "concept", concept.id)
            )
        )
    );

    lines.push(
        "",
        "Do not use internal ids, scheduling fields, unrelated source entities, or knowledge that is not stated above.",
        "Do not add multiple-choice options. The learner must answer by typing freely."
    );

    return lines.join("\n");
}

function normalizeOutput(
    output: PracticeItemContentGenerationOutput
): PracticeItemContentGenerationOutput {
    const expectedAnswerText = output.expectedAnswer.text.trim();

    if (!output.prompt.markdown.trim() || !expectedAnswerText) {
        throw new Error(
            "Practice item generation returned incomplete content."
        );
    }

    return {
        prompt: {
            ...output.prompt,
            title: output.prompt.title.trim(),
            markdown: output.prompt.markdown.trim(),
        },
        expectedAnswer: {
            ...output.expectedAnswer,
            text: expectedAnswerText,
            explanation: output.expectedAnswer.explanation.trim(),
            requiredElements: uniqueNonEmpty(
                output.expectedAnswer.requiredElements
            ),
            commonPitfalls: uniqueNonEmpty(
                output.expectedAnswer.commonPitfalls
            ),
        },
        acceptableAnswers: uniqueNonEmpty([
            expectedAnswerText,
            ...output.acceptableAnswers,
        ]),
    };
}

export class PracticeItemContentGenerationService {
    private readonly modelService: LanguageModelService;

    constructor(
        dependencies: PracticeItemContentGenerationServiceDependencies = {}
    ) {
        this.modelService = dependencies.modelService ?? languageModelService;
    }

    async generateForTarget(input: {
        source: KnowledgePointPracticeSource;
        target: LearningTargetWithEntities;
    }): Promise<PracticeItemContentGenerationOutput> {
        const output = await this.modelService.structuredOutput({
            schema: practiceItemContentGenerationSchema,
            options: PRACTICE_ITEM_CONTENT_GENERATION_PROMPT_OPTIONS,
            input: [
                {
                    role: "system",
                    content: PRACTICE_ITEM_GENERATION_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: createTargetSourceDescription(input),
                },
            ],
        });

        return normalizeOutput(output);
    }
}
