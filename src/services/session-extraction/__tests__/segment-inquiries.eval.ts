import type { LanguageModelService } from "@/services/llm/language-model-service";

import { segmentInquiries } from "../segment-inquiries";
import type { InquirySlice, TranscriptSnapshot } from "../types";

type ExpectedInquiry = {
    keywords: string[];
    messageIds: string[];
    sourceLanguage?: string;
    targetLanguage?: string;
};

export type SegmentInquiryEvalCase = {
    id: string;
    description: string;
    snapshot: TranscriptSnapshot;
    expected: {
        inquiryCount: number;
        inquiries: ExpectedInquiry[];
    };
};

type EvaluatedInquirySummary = {
    tempId: string;
    title: string;
    userNeed: string;
    primaryLanguageContext: string;
    messageIds: string[];
};

export type SegmentInquiryCaseResult = {
    id: string;
    description: string;
    score: number;
    passed: boolean;
    details: {
        countScore: number;
        matchScore: number;
        actualCount: number;
        expectedCount: number;
    };
    actualInquiries: EvaluatedInquirySummary[];
    expectedInquiries: ExpectedInquiry[];
    error?: string;
};

export type SegmentInquirySuiteResult = {
    accuracy: number;
    passed: boolean;
    threshold: number;
    results: SegmentInquiryCaseResult[];
};

export const SEGMENT_INQUIRY_CASE_THRESHOLD = 0.7;
export const SEGMENT_INQUIRY_SUITE_THRESHOLD = 0.8;

export type SegmentInquiryEvaluationOptions = {
    modelService: LanguageModelService;
    threshold?: number;
};

function createSnapshot(
    sessionId: string,
    messages: Pick<
        TranscriptSnapshot["messages"][number],
        "id" | "role" | "sequence" | "text"
    >[]
): TranscriptSnapshot {
    return {
        sessionId,
        userId: "user:test",
        title: `Eval case ${sessionId}`,
        startedAt: "2026-07-05T00:00:00.000Z",
        transcriptHash: `hash:${sessionId}`,
        messages: messages.map((message) => ({
            ...message,
            createdAt: "2026-07-05T00:00:00.000Z",
            nonTextBlocks: [],
        })),
    };
}

export const segmentInquiryEvalCases: SegmentInquiryEvalCase[] = [
    {
        id: "single-restaurant-request",
        description: "Extracts one concrete restaurant expression inquiry.",
        snapshot: createSnapshot("single-restaurant-request", [
            {
                id: "m1",
                role: "user",
                sequence: 1,
                text: "\u6211\u60f3\u5728\u9910\u5385\u8bf7\u670d\u52a1\u5458\u7ed9\u70e4\u571f\u8c46\u591a\u52a0\u57f9\u6839\u788e\uff0c\u82f1\u6587\u600e\u4e48\u8bf4\uff1f",
            },
            {
                id: "m2",
                role: "assistant",
                sequence: 2,
                text: "> Could I get extra bacon bits on my baked potato?\n\nThis sounds natural and polite-casual in a US restaurant.",
            },
        ]),
        expected: {
            inquiryCount: 1,
            inquiries: [
                {
                    keywords: ["extra", "bacon bits", "baked potato"],
                    messageIds: ["m1", "m2"],
                    sourceLanguage: "zh-CN",
                    targetLanguage: "en",
                },
            ],
        },
    },
    {
        id: "two-independent-inquiries",
        description: "Keeps two unrelated expression questions separate.",
        snapshot: createSnapshot("two-independent-inquiries", [
            {
                id: "m1",
                role: "user",
                sequence: 1,
                text: "How do I say power outlet in American English, and how do I politely ask someone to scoot over on a bench?",
            },
            {
                id: "m2",
                role: "assistant",
                sequence: 2,
                text: "Use `power outlet` or `outlet` in the US. For the bench, say `Could you scoot over a bit?`",
            },
        ]),
        expected: {
            inquiryCount: 2,
            inquiries: [
                {
                    keywords: ["power outlet", "American English"],
                    messageIds: ["m1", "m2"],
                    targetLanguage: "en",
                },
                {
                    keywords: ["scoot over", "bench"],
                    messageIds: ["m1", "m2"],
                    targetLanguage: "en",
                },
            ],
        },
    },
    {
        id: "no-durable-friction",
        description: "Returns no inquiries when there is no learning friction.",
        snapshot: createSnapshot("no-durable-friction", [
            {
                id: "m1",
                role: "user",
                sequence: 1,
                text: "Thanks, that helps.",
            },
            {
                id: "m2",
                role: "assistant",
                sequence: 2,
                text: "You're welcome.",
            },
        ]),
        expected: {
            inquiryCount: 0,
            inquiries: [],
        },
    },
    {
        id: "literal-translation-correction",
        description: "Captures one correction inquiry instead of two topics.",
        snapshot: createSnapshot("literal-translation-correction", [
            {
                id: "m1",
                role: "user",
                sequence: 1,
                text: "I said 'open the light'. Should I say 'turn on the light'?",
            },
            {
                id: "m2",
                role: "assistant",
                sequence: 2,
                text: "`Turn on the light` is natural. `Open the light` sounds like a literal translation.",
            },
        ]),
        expected: {
            inquiryCount: 1,
            inquiries: [
                {
                    keywords: ["turn on the light", "open the light"],
                    messageIds: ["m1", "m2"],
                    targetLanguage: "en",
                },
            ],
        },
    },
];

function normalizeText(text: string) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function countScore(actualCount: number, expectedCount: number) {
    if (expectedCount === 0) {
        return actualCount === 0 ? 1 : 0;
    }

    return Math.max(
        0,
        1 - Math.abs(actualCount - expectedCount) / expectedCount
    );
}

function inquiryText(inquiry: InquirySlice) {
    return normalizeText(
        [
            inquiry.title,
            inquiry.userNeed,
            inquiry.contextSummary,
            inquiry.primaryLanguageContext,
            inquiry.reason,
        ].join(" ")
    );
}

function keywordCoverage(inquiry: InquirySlice, expected: ExpectedInquiry) {
    const text = inquiryText(inquiry);
    const matched = expected.keywords.filter((keyword) =>
        text.includes(normalizeText(keyword))
    );

    return expected.keywords.length === 0
        ? 1
        : matched.length / expected.keywords.length;
}

function messageCoverage(inquiry: InquirySlice, expected: ExpectedInquiry) {
    const actualIds = new Set(
        inquiry.messageLinks.map((link) => link.messageId)
    );
    const matched = expected.messageIds.filter((messageId) =>
        actualIds.has(messageId)
    );

    return expected.messageIds.length === 0
        ? 1
        : matched.length / expected.messageIds.length;
}

function languageScore(inquiry: InquirySlice, expected: ExpectedInquiry) {
    const checks = [
        expected.sourceLanguage
            ? inquiry.sourceLanguage === expected.sourceLanguage
            : true,
        expected.targetLanguage
            ? inquiry.targetLanguage === expected.targetLanguage
            : true,
    ];

    return checks.filter(Boolean).length / checks.length;
}

function bestInquiryMatchScore(
    actualInquiries: InquirySlice[],
    expected: ExpectedInquiry
) {
    if (actualInquiries.length === 0) {
        return 0;
    }

    return Math.max(
        ...actualInquiries.map((inquiry) => {
            return (
                keywordCoverage(inquiry, expected) * 0.5 +
                messageCoverage(inquiry, expected) * 0.35 +
                languageScore(inquiry, expected) * 0.15
            );
        })
    );
}

function matchScore(
    actualInquiries: InquirySlice[],
    expectedInquiries: ExpectedInquiry[]
) {
    if (expectedInquiries.length === 0) {
        return actualInquiries.length === 0 ? 1 : 0;
    }

    const total = expectedInquiries.reduce(
        (score, expected) =>
            score + bestInquiryMatchScore(actualInquiries, expected),
        0
    );

    return total / expectedInquiries.length;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export async function evaluateSegmentInquiryCase(
    testCase: SegmentInquiryEvalCase,
    modelService: LanguageModelService
): Promise<SegmentInquiryCaseResult> {
    let actual: InquirySlice[] = [];
    let error: string | undefined;

    try {
        actual = await segmentInquiries(testCase.snapshot, modelService, true);
    } catch (caughtError) {
        error = errorMessage(caughtError);
    }

    const count = error
        ? 0
        : countScore(actual.length, testCase.expected.inquiryCount);
    const match = error ? 0 : matchScore(actual, testCase.expected.inquiries);
    const score = count * 0.25 + match * 0.75;

    return {
        id: testCase.id,
        description: testCase.description,
        score,
        passed: score >= SEGMENT_INQUIRY_CASE_THRESHOLD,
        details: {
            countScore: count,
            matchScore: match,
            actualCount: actual.length,
            expectedCount: testCase.expected.inquiryCount,
        },
        actualInquiries: actual.map((inquiry) => ({
            tempId: inquiry.tempId,
            title: inquiry.title,
            userNeed: inquiry.userNeed,
            primaryLanguageContext: inquiry.primaryLanguageContext,
            messageIds: inquiry.messageLinks.map((link) => link.messageId),
        })),
        expectedInquiries: testCase.expected.inquiries,
        error,
    };
}

export async function evaluateSegmentInquiryCases({
    modelService,
    threshold = SEGMENT_INQUIRY_SUITE_THRESHOLD,
}: SegmentInquiryEvaluationOptions): Promise<SegmentInquirySuiteResult> {
    const results: SegmentInquiryCaseResult[] = [];

    for (const testCase of segmentInquiryEvalCases) {
        results.push(await evaluateSegmentInquiryCase(testCase, modelService));
    }

    const accuracy =
        results.reduce((sum, result) => sum + result.score, 0) /
        Math.max(1, results.length);

    return {
        accuracy,
        passed: accuracy >= threshold,
        threshold,
        results,
    };
}

export function formatPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

export function formatSegmentInquiryCaseResult(
    result: SegmentInquiryCaseResult
) {
    const status = result.passed ? "PASS" : "CHECK";
    const { details } = result;

    return [
        `[${status}] ${result.id}`,
        `score=${formatPercent(result.score)}`,
        `count=${details.actualCount}/${details.expectedCount}`,
        `countScore=${formatPercent(details.countScore)}`,
        `matchScore=${formatPercent(details.matchScore)}`,
        result.description,
    ].join(" | ");
}

export function formatSegmentInquirySuiteResult(
    result: SegmentInquirySuiteResult
) {
    return (
        `segmentInquiries accuracy: ${formatPercent(result.accuracy)} ` +
        `(threshold ${formatPercent(result.threshold)})`
    );
}
