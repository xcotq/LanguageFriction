import { jsonSchema } from "ai";

import type { LanguageModelService } from "@/services/llm/language-model-service";
import {
    SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS,
    createSessionInquirySegmentationPrompt,
} from "@/services/llm/prompts/session-extraction-prompts";
import type { InquiryMessageRole } from "@/types/domain";

import { createDeterministicId, truncateText } from "./stable";
import {
    asRecord,
    asString,
    clampConfidence,
    isNonNullable,
} from "./structured-output-normalizers";
import {
    createDefaultMessageLinks,
    firstUserMessage,
    inferSourceLanguage,
    titleFromRecommendedUtterance,
} from "./transcript-heuristics";
import type { InquirySlice, TranscriptSnapshot } from "./types";

export type SegmentInquiriesOutput = {
    inquiries: InquirySlice[];
};

const inquiryMessageRoles: InquiryMessageRole[] = [
    "primary_question",
    "clarification",
    "answer",
    "correction",
    "supporting",
];

export const segmentInquiriesSchema = jsonSchema<SegmentInquiriesOutput>({
    type: "object",
    properties: {
        inquiries: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tempId: { type: "string" },
                    title: { type: "string" },
                    userNeed: { type: "string" },
                    contextSummary: { type: "string" },
                    sourceLanguage: { type: ["string", "null"] },
                    targetLanguage: { type: "string" },
                    messageLinks: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                messageId: { type: "string" },
                                role: {
                                    type: "string",
                                    enum: inquiryMessageRoles,
                                },
                                sequence: { type: ["number", "null"] },
                            },
                            required: ["messageId", "role", "sequence"],
                            additionalProperties: false,
                        },
                    },
                    confidence: { type: "number" },
                    reason: { type: "string" },
                },
                required: [
                    "tempId",
                    "title",
                    "userNeed",
                    "contextSummary",
                    "sourceLanguage",
                    "targetLanguage",
                    "messageLinks",
                    "confidence",
                    "reason",
                ],
                additionalProperties: false,
            },
        },
    },
    required: ["inquiries"],
    additionalProperties: false,
});

function normalizeMessageLinks(
    value: unknown,
    snapshot: TranscriptSnapshot
): InquirySlice["messageLinks"] {
    const validMessageIds = new Set(
        snapshot.messages.map((message) => message.id)
    );

    const links = Array.isArray(value)
        ? value
              .map(
                  (
                      item,
                      index
                  ): InquirySlice["messageLinks"][number] | null => {
                      const record = asRecord(item);
                      const messageId = asString(record.messageId);
                      const role = asString(record.role) as InquiryMessageRole;

                      if (
                          !validMessageIds.has(messageId) ||
                          !inquiryMessageRoles.includes(role)
                      ) {
                          return null;
                      }

                      return {
                          messageId,
                          role,
                          sequence:
                              typeof record.sequence === "number"
                                  ? record.sequence
                                  : index + 1,
                      };
                  }
              )
              .filter(isNonNullable)
        : [];

    return links.length > 0 ? links : createDefaultMessageLinks(snapshot);
}

export function normalizeInquirySlices(
    output: SegmentInquiriesOutput,
    snapshot: TranscriptSnapshot
): InquirySlice[] {
    const records = Array.isArray(output.inquiries) ? output.inquiries : [];

    return records
        .map((rawSlice, index): InquirySlice | null => {
            const record = asRecord(rawSlice);
            const userNeed = asString(record.userNeed);

            if (!userNeed) {
                return null;
            }

            const title = asString(
                record.title,
                truncateText(userNeed, 64) || "Language friction inquiry"
            );

            return {
                tempId: asString(
                    record.tempId,
                    createDeterministicId("inq", {
                        sessionId: snapshot.sessionId,
                        transcriptHash: snapshot.transcriptHash,
                        index,
                    })
                ),
                title,
                userNeed,
                contextSummary: asString(
                    record.contextSummary,
                    "Concrete expression question from the session."
                ),
                sourceLanguage: asString(record.sourceLanguage) || undefined,
                targetLanguage: asString(record.targetLanguage, "en"),
                messageLinks: normalizeMessageLinks(
                    record.messageLinks,
                    snapshot
                ),
                confidence: clampConfidence(record.confidence),
                reason: asString(record.reason, "Structured extraction."),
            };
        })
        .filter(isNonNullable)
        .slice(0, 6);
}

export function createHeuristicInquirySlices(
    snapshot: TranscriptSnapshot
): InquirySlice[] {
    const userMessage = firstUserMessage(snapshot);

    if (!userMessage) {
        return [];
    }

    const title = titleFromRecommendedUtterance(snapshot, userMessage.text);

    return [
        {
            tempId: createDeterministicId("inq", {
                sessionId: snapshot.sessionId,
                messageId: userMessage.id,
                text: userMessage.text,
            }),
            title: title || "Language friction inquiry",
            userNeed: userMessage.text,
            contextSummary:
                "User asked a concrete expression question during this session.",
            sourceLanguage: inferSourceLanguage(userMessage.text),
            targetLanguage: "en",
            messageLinks: createDefaultMessageLinks(snapshot),
            confidence: 0.62,
            reason: "Local fallback segmentation for mock mode.",
        },
    ];
}

export async function segmentInquiries(
    snapshot: TranscriptSnapshot,
    modelService: LanguageModelService,
    useModel: boolean
) {
    if (!useModel) {
        return createHeuristicInquirySlices(snapshot);
    }

    const output = await modelService.structuredOutput({
        schema: segmentInquiriesSchema,
        options: SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS,
        input: createSessionInquirySegmentationPrompt(snapshot),
    });

    return normalizeInquirySlices(output, snapshot);
}
