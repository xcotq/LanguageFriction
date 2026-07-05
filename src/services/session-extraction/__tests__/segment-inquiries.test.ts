import { createTestLanguageModelService } from "@/test-utils/language-model";

import {
    evaluateSegmentInquiryCases,
    formatSegmentInquiryCaseResult,
    formatSegmentInquirySuiteResult,
    segmentInquiryEvalCases,
    type SegmentInquiryCaseResult,
    type SegmentInquirySuiteResult,
} from "./segment-inquiries.eval";

jest.setTimeout(300_000);

describe("@segment-inquiries segmentInquiries eval", () => {
    let suiteResult: SegmentInquirySuiteResult;
    let caseResultsById: Map<string, SegmentInquiryCaseResult>;

    beforeAll(async () => {
        const modelService = createTestLanguageModelService();

        suiteResult = await evaluateSegmentInquiryCases({ modelService });
        caseResultsById = new Map(
            suiteResult.results.map((result) => [result.id, result])
        );
    });

    test.each(segmentInquiryEvalCases)("scores case: $id", (testCase) => {
        const result = caseResultsById.get(testCase.id);

        if (!result) {
            throw new Error(`No eval result found for case ${testCase.id}.`);
        }

        console.info(formatSegmentInquiryCaseResult(result));
        console.info(
            JSON.stringify(
                {
                    id: result.id,
                    passed: result.passed,
                    score: result.score,
                    details: result.details,
                    actualInquiries: result.actualInquiries,
                    expectedInquiries: result.expectedInquiries,
                    error: result.error,
                },
                null,
                2
            )
        );

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
    });

    test("meets overall accuracy threshold", () => {
        console.info(formatSegmentInquirySuiteResult(suiteResult));
        console.info(
            JSON.stringify(
                {
                    accuracy: suiteResult.accuracy,
                    threshold: suiteResult.threshold,
                    passed: suiteResult.passed,
                    caseResults: suiteResult.results.map((caseResult) => ({
                        id: caseResult.id,
                        passed: caseResult.passed,
                        score: caseResult.score,
                        details: caseResult.details,
                        error: caseResult.error,
                    })),
                },
                null,
                2
            )
        );

        expect(suiteResult.accuracy).toBeGreaterThanOrEqual(
            suiteResult.threshold
        );
    });
});
