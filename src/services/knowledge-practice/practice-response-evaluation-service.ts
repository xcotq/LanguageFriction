import { jsonSchema } from "ai";

import {
    PracticeRepository,
    type PracticeItemDetail,
    type PracticeItemTargetDetail,
} from "@/data/repositories/practice.repository";
import {
    languageModelService,
    type LanguageModelService,
} from "@/services/llm/language-model-service";
import {
    PRACTICE_ANSWER_EVALUATION_PROMPT_OPTIONS,
    createPracticeAnswerEvaluationPrompt,
} from "@/services/llm/prompts/practice-evaluation-prompts";
import type {
    LearningEvidence,
    LearningEvidenceResult,
    LearningTarget,
    PracticeItem,
    UserResponse,
} from "@/types/domain";

type DirectEvaluationResult = "correct" | "partial" | "failed";

type EvaluationIssue = {
    kind:
        | "missing_required_expression"
        | "wrong_meaning"
        | "wrong_register"
        | "unnatural_collocation"
        | "grammar"
        | "too_literal"
        | "incomplete";
    severity: "minor" | "major";
    note: string;
    relatedEntityId?: string;
};

type ModelTargetResult = {
    learningTargetId: string;
    result: DirectEvaluationResult;
    confidence: number;
    reason: string;
    issues: EvaluationIssue[];
    acceptedAlternative?: string;
};

type PracticeAnswerEvaluationOutput = {
    feedbackSummary: string;
    targetResults: ModelTargetResult[];
};

type NormalizedAnswer = {
    raw: string;
    normalized: string;
    tokens: string[];
};

type EvaluatorStatus = "local_blank" | "llm_structured" | "llm_unavailable";

type DirectTargetOutcome = {
    result: LearningEvidenceResult;
    confidence?: number;
    reason: string;
    issues?: EvaluationIssue[];
    acceptedAlternative?: string;
    evaluator: EvaluatorStatus;
};

type EvaluationRunResult = {
    outcomes: Map<string, DirectTargetOutcome>;
    feedbackSummary?: string;
};

export type PracticeAnswerPayload = {
    text: string;
    interaction?: {
        revealedAnswerBeforeSubmit?: boolean;
        usedHint?: boolean;
    };
};

export type PracticeUserFeedback = {
    summary: string;
    result: LearningEvidenceResult;
    details?: {
        title: string;
        message: string;
        severity: "info" | "warning" | "error";
    }[];
};

export type PracticeEvaluationResult = {
    response: UserResponse;
    evidence: LearningEvidence[];
    targetUpdates: LearningTarget[];
    feedback: PracticeUserFeedback;
};

type PracticeResponseEvaluationServiceDependencies = {
    practiceRepository: PracticeRepository;
    modelService?: LanguageModelService;
};

const directEvaluationResults: DirectEvaluationResult[] = [
    "correct",
    "partial",
    "failed",
];

const issueKinds: EvaluationIssue["kind"][] = [
    "missing_required_expression",
    "wrong_meaning",
    "wrong_register",
    "unnatural_collocation",
    "grammar",
    "too_literal",
    "incomplete",
] as EvaluationIssue["kind"][];

const issueSeverities: EvaluationIssue["severity"][] = ["minor", "major"];

const practiceAnswerEvaluationSchema =
    jsonSchema<PracticeAnswerEvaluationOutput>({
        type: "object",
        properties: {
            feedbackSummary: { type: "string" },
            targetResults: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        learningTargetId: { type: "string" },
                        result: {
                            type: "string",
                            enum: directEvaluationResults,
                        },
                        confidence: { type: "number" },
                        reason: { type: "string" },
                        issues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    kind: {
                                        type: "string",
                                        enum: issueKinds,
                                    },
                                    severity: {
                                        type: "string",
                                        enum: issueSeverities,
                                    },
                                    note: { type: "string" },
                                    relatedEntityId: {
                                        type: ["string", "null"],
                                    },
                                },
                                required: [
                                    "kind",
                                    "severity",
                                    "note",
                                    "relatedEntityId",
                                ],
                                additionalProperties: false,
                            },
                        },
                        acceptedAlternative: { type: ["string", "null"] },
                    },
                    required: [
                        "learningTargetId",
                        "result",
                        "confidence",
                        "reason",
                        "issues",
                        "acceptedAlternative",
                    ],
                    additionalProperties: false,
                },
            },
        },
        required: ["feedbackSummary", "targetResults"],
        additionalProperties: false,
    });

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

function createPracticeResponseId(input: {
    practiceItemId: string;
    userId: string;
    now: Date;
}) {
    const suffix = Math.random().toString(36).slice(2, 8);

    return `response:${input.practiceItemId}:${input.userId}:${formatResponseTimestamp(input.now)}:${suffix}`;
}

function normalizeAnswerText(text: string): NormalizedAnswer {
    const normalized = text
        .trim()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/\s+/g, " ")
        .replace(/[.!?]+$/g, "")
        .toLowerCase();

    return {
        raw: text,
        normalized,
        tokens: normalized ? normalized.split(/\s+/) : [],
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function asString(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

function clampConfidence(value: unknown, fallback = 0.7) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : fallback;
}

function practiceKind(item: PracticeItem) {
    return (
        asString(asRecord(item.contextSnapshot).kind) ||
        asString(asRecord(item.prompt).kind) ||
        item.type
    );
}

function expectedAnswerTexts(item: PracticeItem) {
    const expectedAnswer = item.expectedAnswer;
    const expectedRecord = asRecord(expectedAnswer);
    const expectedText =
        typeof expectedAnswer === "string"
            ? expectedAnswer
            : asString(expectedRecord.text);
    const acceptableAnswers = asStringArray(item.acceptableAnswers);

    return [...new Set([expectedText, ...acceptableAnswers].filter(Boolean))];
}

function isDirectlyTestedTarget(detail: PracticeItemTargetDetail) {
    return detail.link.weight >= 1;
}

function addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function baseDays(target: LearningTarget) {
    switch (target.difficulty) {
        case "low":
            return 2;
        case "high":
            return 0.5;
        case "medium":
        default:
            return 1;
    }
}

function applyEvidenceToLearningTarget(
    target: LearningTarget,
    evidence: LearningEvidence,
    now: Date
): LearningTarget | null {
    const base = baseDays(target);
    const effectiveReview = Math.max(0, target.reviewCount - target.lapseCount);
    const nextCorrectInterval = base * 2 ** effectiveReview;
    let stability: number;
    let lapseCount = target.lapseCount;

    switch (evidence.result) {
        case "correct":
            stability = nextCorrectInterval;
            break;
        case "partial":
            stability = Math.max(0.5, nextCorrectInterval * 0.5);
            break;
        case "hinted":
            stability = Math.max(0.25, nextCorrectInterval * 0.25);
            break;
        case "failed":
            stability = base;
            lapseCount += 1;
            break;
        case "exposed":
        case "not_tested":
            return null;
    }

    return {
        ...target,
        stability,
        dueAt:
            evidence.result === "failed"
                ? addDays(now, 0.25)
                : addDays(now, stability),
        lastReviewedAt: now,
        reviewCount: target.reviewCount + 1,
        lapseCount,
        updatedAt: now,
    };
}

function aggregateFeedbackResult(evidence: LearningEvidence[]) {
    const directResults = evidence
        .map((item) => item.result)
        .filter((result) => result !== "exposed");

    if (directResults.includes("failed")) {
        return "failed";
    }

    if (directResults.includes("partial")) {
        return "partial";
    }

    if (directResults.includes("hinted")) {
        return "hinted";
    }

    if (directResults.includes("correct")) {
        return "correct";
    }

    return "not_tested";
}

function defaultFeedbackSummary(result: LearningEvidenceResult) {
    switch (result) {
        case "correct":
            return "Nice. The answer shows solid control of this target.";
        case "partial":
            return "Almost there. The answer shows partial control, but still needs refinement.";
        case "failed":
            return "This target needs another review.";
        case "hinted":
            return "Saved as hinted practice because the answer was revealed before submission.";
        case "exposed":
            return "This target was exposed indirectly.";
        case "not_tested":
            return "Response saved, but evaluation could not produce reliable learning evidence.";
    }
}

function normalizeModelTargetResults(
    output: PracticeAnswerEvaluationOutput,
    directTargetIds: Set<string>
) {
    const resultByTargetId = new Map<string, ModelTargetResult>();

    for (const rawResult of Array.isArray(output.targetResults)
        ? output.targetResults
        : []) {
        const record = asRecord(rawResult);
        const learningTargetId = asString(record.learningTargetId);
        const result = asString(record.result) as DirectEvaluationResult;

        if (
            !directTargetIds.has(learningTargetId) ||
            !directEvaluationResults.includes(result)
        ) {
            continue;
        }

        resultByTargetId.set(learningTargetId, {
            learningTargetId,
            result,
            confidence: clampConfidence(record.confidence),
            reason: asString(record.reason, "LLM structured evaluation."),
            issues: normalizeEvaluationIssues(record.issues),
            acceptedAlternative:
                asString(record.acceptedAlternative) || undefined,
        });
    }

    return resultByTargetId;
}

function normalizeEvaluationIssues(value: unknown): EvaluationIssue[] {
    return Array.isArray(value)
        ? value
              .map((item): EvaluationIssue | null => {
                  const record = asRecord(item);
                  const kind = asString(record.kind) as EvaluationIssue["kind"];
                  const severity = asString(
                      record.severity
                  ) as EvaluationIssue["severity"];
                  const note = asString(record.note);

                  if (
                      !issueKinds.includes(kind) ||
                      !issueSeverities.includes(severity) ||
                      !note
                  ) {
                      return null;
                  }

                  return {
                      kind,
                      severity,
                      note,
                      relatedEntityId:
                          asString(record.relatedEntityId) || undefined,
                  };
              })
              .filter((item): item is EvaluationIssue => Boolean(item))
        : [];
}

function buildEvaluationContext(input: {
    detail: PracticeItemDetail;
    directTargets: PracticeItemTargetDetail[];
    answer: NormalizedAnswer;
    payload: PracticeAnswerPayload;
}) {
    const { detail, directTargets, answer, payload } = input;
    const expectedTexts = expectedAnswerTexts(detail.item);
    const expectedNormalizedTexts = expectedTexts.map(
        (text) => normalizeAnswerText(text).normalized
    );

    return {
        practiceItem: {
            id: detail.item.id,
            type: detail.item.type,
            kind: practiceKind(detail.item),
            prompt: detail.item.prompt,
            expectedAnswer: detail.item.expectedAnswer,
            acceptableAnswers: detail.item.acceptableAnswers,
            contextSnapshot: detail.item.contextSnapshot,
        },
        userAnswer: {
            text: answer.raw,
            normalizedText: answer.normalized,
            interaction: payload.interaction,
        },
        localSignals: {
            blank: answer.normalized.length === 0,
            exactMatch: expectedNormalizedTexts.includes(answer.normalized),
            answerTokenCount: answer.tokens.length,
        },
        directlyTestedTargets: directTargets.map((targetDetail) => ({
            learningTargetId: targetDetail.target.id,
            ability: targetDetail.target.ability,
            difficulty: targetDetail.target.difficulty,
            weight: targetDetail.link.weight,
            entities: targetDetail.entities,
        })),
    };
}

export class PracticeResponseEvaluationService {
    private readonly practiceRepository: PracticeRepository;
    private readonly modelService: LanguageModelService;

    constructor(dependencies: PracticeResponseEvaluationServiceDependencies) {
        this.practiceRepository = dependencies.practiceRepository;
        this.modelService = dependencies.modelService ?? languageModelService;
    }

    async evaluate(input: {
        userId: string;
        practiceItemId: string;
        answer: PracticeAnswerPayload;
        now?: Date;
    }): Promise<PracticeEvaluationResult> {
        const now = input.now ?? new Date();
        const detail = await this.practiceRepository.getPracticeItemDetail(
            input.userId,
            input.practiceItemId,
            now
        );

        if (!detail) {
            throw new Error("Practice item not found.");
        }

        const normalizedAnswer = normalizeAnswerText(input.answer.text);
        const response: UserResponse = {
            id: createPracticeResponseId({
                practiceItemId: input.practiceItemId,
                userId: input.userId,
                now,
            }),
            practiceItemId: input.practiceItemId,
            userId: input.userId,
            answer: input.answer,
            submittedAt: now,
        };
        const directTargets = detail.targets.filter(isDirectlyTestedTarget);
        const evaluation = normalizedAnswer.normalized
            ? await this.evaluateWithModel({
                  detail,
                  directTargets,
                  normalizedAnswer,
                  payload: input.answer,
              })
            : { outcomes: this.createBlankOutcomes(directTargets) };
        const evidence = this.createEvidence({
            response,
            detail,
            directTargets,
            outcomes: evaluation.outcomes,
            normalizedAnswer,
            now,
        });
        const targetUpdates = this.createTargetUpdates(detail, evidence, now);
        const feedback = this.createFeedback(
            evidence,
            evaluation.outcomes,
            evaluation.feedbackSummary
        );

        response.feedback = feedback;

        await this.practiceRepository.recordEvaluatedResponse({
            response,
            evidence,
            targetUpdates,
        });

        return {
            response,
            evidence,
            targetUpdates,
            feedback,
        };
    }

    private async evaluateWithModel(input: {
        detail: PracticeItemDetail;
        directTargets: PracticeItemTargetDetail[];
        normalizedAnswer: NormalizedAnswer;
        payload: PracticeAnswerPayload;
    }): Promise<EvaluationRunResult> {
        const directTargetIds = new Set(
            input.directTargets.map(({ target }) => target.id)
        );

        try {
            const output = await this.modelService.structuredOutput({
                schema: practiceAnswerEvaluationSchema,
                options: PRACTICE_ANSWER_EVALUATION_PROMPT_OPTIONS,
                input: createPracticeAnswerEvaluationPrompt(
                    buildEvaluationContext({
                        detail: input.detail,
                        directTargets: input.directTargets,
                        answer: input.normalizedAnswer,
                        payload: input.payload,
                    })
                ),
            });

            const modelResults = normalizeModelTargetResults(
                output,
                directTargetIds
            );

            return {
                outcomes: new Map<string, DirectTargetOutcome>(
                    input.directTargets.map(({ target }) => {
                        const modelResult = modelResults.get(target.id);

                        if (!modelResult || modelResult.confidence < 0.35) {
                            return [
                                target.id,
                                {
                                    result: "not_tested",
                                    confidence: modelResult?.confidence ?? 0.3,
                                    reason:
                                        modelResult?.reason ??
                                        "LLM did not return a reliable result for this target.",
                                    issues: modelResult?.issues,
                                    acceptedAlternative:
                                        modelResult?.acceptedAlternative,
                                    evaluator: "llm_unavailable",
                                } satisfies DirectTargetOutcome,
                            ];
                        }

                        return [
                            target.id,
                            {
                                result: this.applyInteractionAdjustment(
                                    modelResult.result,
                                    input.payload
                                ),
                                confidence: modelResult.confidence,
                                reason: modelResult.reason,
                                issues: modelResult.issues,
                                acceptedAlternative:
                                    modelResult.acceptedAlternative,
                                evaluator: "llm_structured",
                            } satisfies DirectTargetOutcome,
                        ];
                    })
                ),
                feedbackSummary: asString(output.feedbackSummary) || undefined,
            };
        } catch (error) {
            console.error("Failed to evaluate practice answer", error);

            return {
                outcomes: new Map<string, DirectTargetOutcome>(
                    input.directTargets.map(({ target }) => [
                        target.id,
                        {
                            result: "not_tested",
                            confidence: 0.3,
                            reason: "LLM evaluation was unavailable.",
                            evaluator: "llm_unavailable",
                        } satisfies DirectTargetOutcome,
                    ])
                ),
            };
        }
    }

    private applyInteractionAdjustment(
        result: DirectEvaluationResult,
        payload: PracticeAnswerPayload
    ): LearningEvidenceResult {
        if (
            result === "correct" &&
            (payload.interaction?.revealedAnswerBeforeSubmit ||
                payload.interaction?.usedHint)
        ) {
            return "hinted";
        }

        return result;
    }

    private createBlankOutcomes(directTargets: PracticeItemTargetDetail[]) {
        return new Map<string, DirectTargetOutcome>(
            directTargets.map(({ target }) => [
                target.id,
                {
                    result: "failed",
                    confidence: 1,
                    reason: "The submitted answer was blank.",
                    issues: [
                        {
                            kind: "incomplete",
                            severity: "major",
                            note: "No answer was provided.",
                        },
                    ],
                    evaluator: "local_blank",
                } satisfies DirectTargetOutcome,
            ])
        );
    }

    private createEvidence(input: {
        response: UserResponse;
        detail: PracticeItemDetail;
        directTargets: PracticeItemTargetDetail[];
        outcomes: Map<string, DirectTargetOutcome>;
        normalizedAnswer: NormalizedAnswer;
        now: Date;
    }) {
        const directTargetIds = new Set(
            input.directTargets.map(({ target }) => target.id)
        );
        const kind = practiceKind(input.detail.item);

        return input.detail.targets.map(({ target, link }) => {
            const outcome = input.outcomes.get(target.id);
            const result: LearningEvidenceResult = directTargetIds.has(
                target.id
            )
                ? (outcome?.result ?? "not_tested")
                : "exposed";

            return {
                id: `evidence:${input.response.id}:${target.id}`,
                userResponseId: input.response.id,
                learningTargetId: target.id,
                result,
                confidence: directTargetIds.has(target.id)
                    ? outcome?.confidence
                    : 1,
                error: {
                    kind,
                    evaluator: outcome?.evaluator ?? "llm_unavailable",
                    reason: outcome?.reason ?? "Indirect target exposure.",
                    issues: outcome?.issues ?? [],
                    acceptedAlternative: outcome?.acceptedAlternative,
                    linkWeight: link.weight,
                    normalizedAnswer: input.normalizedAnswer.normalized,
                },
                createdAt: input.now,
            } satisfies LearningEvidence;
        });
    }

    private createTargetUpdates(
        detail: PracticeItemDetail,
        evidence: LearningEvidence[],
        now: Date
    ) {
        const targetById = new Map(
            detail.targets.map(({ target }) => [target.id, target])
        );

        return evidence
            .map((item) => {
                const target = targetById.get(item.learningTargetId);

                return target
                    ? applyEvidenceToLearningTarget(target, item, now)
                    : null;
            })
            .filter((target): target is LearningTarget => Boolean(target));
    }

    private createFeedback(
        evidence: LearningEvidence[],
        outcomes: Map<string, DirectTargetOutcome>,
        feedbackSummary?: string
    ): PracticeUserFeedback {
        const result = aggregateFeedbackResult(evidence);
        const firstOutcome = [...outcomes.values()][0];
        const summary =
            feedbackSummary ??
            (firstOutcome?.evaluator === "llm_structured"
                ? firstOutcome.reason
                : defaultFeedbackSummary(result));

        return {
            result,
            summary,
            details: [...outcomes.values()].flatMap((outcome) =>
                (outcome.issues ?? []).map((issue) => ({
                    title: issue.kind.replaceAll("_", " "),
                    message: issue.note,
                    severity: issue.severity === "major" ? "warning" : "info",
                }))
            ),
        };
    }
}
