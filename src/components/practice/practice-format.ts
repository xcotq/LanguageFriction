import type {
    LearningAbility,
    LearningEvidenceResult,
    LearningTargetStatus,
    PracticeItemType,
} from "@/types/domain";

type FormatValueOptions = {
    preferText?: boolean;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(
    value: Record<string, unknown>,
    keys: string[]
): string | undefined {
    for (const key of keys) {
        const candidate = value[key];

        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return undefined;
}

function stringifyCompact(value: unknown) {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (value == null) {
        return "";
    }

    if (
        Array.isArray(value) &&
        value.every(
            (item) =>
                typeof item === "string" ||
                typeof item === "number" ||
                typeof item === "boolean"
        )
    ) {
        return value.map(String).join(", ");
    }

    return JSON.stringify(value, null, 2);
}

export function formatPracticeItemType(type: PracticeItemType) {
    switch (type) {
        case "flashcard":
            return "Flashcard";
        case "free_response":
            return "Free response";
        case "translation":
            return "Translation";
        case "scenario_response":
            return "Scenario";
        case "multiple_choice":
            return "Multiple choice";
        case "correction":
            return "Correction";
    }
}

export function formatLearningAbility(ability: LearningAbility) {
    switch (ability) {
        case "recognition":
            return "Recognition";
        case "recall":
            return "Recall";
        case "contextual_production":
            return "Contextual production";
        case "transfer":
            return "Transfer";
        case "distinction":
            return "Distinction";
    }
}

export function formatLearningTargetStatus(status: LearningTargetStatus) {
    switch (status) {
        case "active":
            return "Active";
        case "paused":
            return "Paused";
        case "mastered":
            return "Mastered";
        case "archived":
            return "Archived";
    }
}

export function formatEvidenceResult(result: LearningEvidenceResult) {
    switch (result) {
        case "correct":
            return "Correct";
        case "partial":
            return "Partial";
        case "failed":
            return "Failed";
        case "hinted":
            return "Hinted";
        case "exposed":
            return "Exposed";
        case "not_tested":
            return "Not tested";
    }
}

export function formatDate(value?: Date) {
    if (!value) {
        return "No date";
    }

    return value.toLocaleDateString();
}

export function formatDateTime(value?: Date) {
    if (!value) {
        return "No time";
    }

    return value.toLocaleString();
}

export function formatPracticePromptSummary(prompt: unknown) {
    if (typeof prompt === "string") {
        return prompt;
    }

    if (isRecord(prompt)) {
        const scenario = firstString(prompt, ["scenario"]);
        const task = firstString(prompt, ["task"]);

        if (scenario && task) {
            return `${scenario} ${task}`;
        }

        const instruction = firstString(prompt, ["instruction"]);
        const clue = firstString(prompt, ["clue"]);

        if (instruction && clue) {
            return `${instruction} ${clue}`;
        }

        return (
            firstString(prompt, [
                "question",
                "front",
                "sourceText",
                "sentence",
                "sourceNeed",
                "objective",
                "kind",
            ]) ?? "Structured practice prompt"
        );
    }

    return stringifyCompact(prompt) || "Practice prompt";
}

export function formatPracticeValue(
    value: unknown,
    options: FormatValueOptions = {}
) {
    if (options.preferText && isRecord(value)) {
        const text = firstString(value, ["text", "answer", "summary"]);

        if (text) {
            return text;
        }
    }

    return stringifyCompact(value);
}

export function shouldRenderPracticeValueAsCode(
    value: unknown,
    options: FormatValueOptions = {}
) {
    if (options.preferText && isRecord(value)) {
        return false;
    }

    if (Array.isArray(value)) {
        return !value.every(
            (item) =>
                typeof item === "string" ||
                typeof item === "number" ||
                typeof item === "boolean"
        );
    }

    return isRecord(value);
}
