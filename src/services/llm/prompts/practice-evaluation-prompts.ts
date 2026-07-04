import type {
    CompletionInput,
    StructuredOutputOptions,
} from "@/providers/language-model-provider";

export const PRACTICE_ANSWER_EVALUATION_SYSTEM_PROMPT = [
    "Evaluate a language learner's practice answer.",
    "The learner answer may be a complex sentence, not a short token.",
    "Return structured evidence for each directly tested learning target.",
    "Use the expected answer, acceptable answers, prompt, context, target ability, and target entities.",
    "Accept natural alternatives when they satisfy the communicative objective, meaning, register, and context.",
    "Use correct only when the answer fully satisfies the target in this context.",
    "Use partial when the answer communicates some target meaning but is incomplete, unnatural, too literal, wrong register, or misses a required expression.",
    "Use failed when the answer has the wrong meaning, wrong context, or misses the core target.",
    "Do not create new knowledge entities. Do not update scheduling. Do not return any result outside the schema.",
].join("\n");

export const PRACTICE_ANSWER_EVALUATION_PROMPT_OPTIONS = {
    name: "PracticeAnswerEvaluation",
    description:
        "Structured evaluation of a practice answer against directly tested learning targets.",
} satisfies StructuredOutputOptions;

export function createPracticeAnswerEvaluationPrompt(
    context: Record<string, unknown>
): CompletionInput {
    return [
        {
            role: "system",
            content: PRACTICE_ANSWER_EVALUATION_SYSTEM_PROMPT,
        },
        {
            role: "user",
            content: JSON.stringify(context, null, 2),
        },
    ];
}
