import { jsonSchema } from "ai";

import {
    DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    type LanguagePreferenceSettings,
} from "@/constants/language-preferences";
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
    description:
        "Structured language-learning inquiry slices extracted from one chat transcript.",
    properties: {
        inquiries: {
            type: "array",
            description:
                "Concrete, durable language-expression inquiries found in the transcript. Return an empty array when the transcript has no reusable language friction.",
            items: {
                type: "object",
                description:
                    "One extracted inquiry representing a specific learner need, not a one-to-one copy of a message.",
                properties: {
                    tempId: {
                        type: "string",
                        description:
                            "Stable temporary identifier for this inquiry within the extraction result, such as inq:restaurant-bacon-bits.",
                    },
                    title: {
                        type: "string",
                        description:
                            "Short human-readable title summarizing the expression question or correction.",
                    },
                    userNeed: {
                        type: "string",
                        description:
                            "The learner's concrete communication need or confusion, rewritten as a reusable inquiry.",
                    },
                    contextSummary: {
                        type: "string",
                        description:
                            "Brief context needed to understand the inquiry, such as scenario, speaker/listener roles, register, or domain.",
                    },
                    primaryLanguageContext: {
                        type: "string",
                        description:
                            "Background details, examples, or source wording written in the learner's primary language. Eg. For a Chinese speaker asking about English, write this field in Chinese.",
                    },
                    sourceLanguage: {
                        type: ["string", "null"],
                        description:
                            "Language the learner used or translated from, if identifiable; use null when not clear.",
                    },
                    targetLanguage: {
                        type: "string",
                        description:
                            "Language the learner wants to produce or understand, usually a BCP-47 code or common language label.",
                    },
                    messageLinks: {
                        type: "array",
                        description:
                            "Links to transcript messages that provide direct evidence for this inquiry.",
                        items: {
                            type: "object",
                            description:
                                "A single evidence link from the inquiry back to a transcript message.",
                            properties: {
                                messageId: {
                                    type: "string",
                                    description:
                                        "ID of a transcript message that appears in the input snapshot.",
                                },
                                role: {
                                    type: "string",
                                    enum: inquiryMessageRoles,
                                    description:
                                        "How this message contributes to the inquiry, such as the primary learner question, assistant answer, or correction.",
                                },
                                sequence: {
                                    type: ["number", "null"],
                                    description:
                                        "Order of this message within the inquiry evidence chain; use null when no meaningful order is available.",
                                },
                            },
                            required: ["messageId", "role", "sequence"],
                            additionalProperties: false,
                        },
                    },
                    reason: {
                        type: "string",
                        description:
                            "Short explanation of why these transcript messages form this inquiry.",
                    },
                },
                required: [
                    "tempId",
                    "title",
                    "userNeed",
                    "contextSummary",
                    "primaryLanguageContext",
                    "sourceLanguage",
                    "targetLanguage",
                    "messageLinks",
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

function createPrimaryLanguageContextFallback(
    snapshot: TranscriptSnapshot,
    messageLinks: InquirySlice["messageLinks"],
    fallbackText: string
) {
    const linkedMessageIds = new Set(
        messageLinks.map((link) => link.messageId)
    );
    const linkedUserText = snapshot.messages
        .filter(
            (message) =>
                message.role === "user" &&
                linkedMessageIds.has(message.id) &&
                message.text.trim()
        )
        .map((message) => message.text.trim())
        .join("\n\n");

    return (
        linkedUserText ||
        firstUserMessage(snapshot)?.text.trim() ||
        fallbackText
    );
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
            const messageLinks = normalizeMessageLinks(
                record.messageLinks,
                snapshot
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
                primaryLanguageContext:
                    asString(record.primaryLanguageContext) ||
                    createPrimaryLanguageContextFallback(
                        snapshot,
                        messageLinks,
                        userNeed
                    ),
                sourceLanguage: asString(record.sourceLanguage) || undefined,
                targetLanguage: asString(record.targetLanguage, "en"),
                messageLinks,
                reason: asString(record.reason, "Structured extraction."),
            };
        })
        .filter(isNonNullable)
        .slice(0, 6);
}

export function createHeuristicInquirySlices(
    snapshot: TranscriptSnapshot,
    languagePreferences: LanguagePreferenceSettings = DEFAULT_LANGUAGE_PREFERENCE_SETTINGS
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
            primaryLanguageContext: userMessage.text,
            sourceLanguage:
                inferSourceLanguage(userMessage.text) ??
                languagePreferences.primaryLanguage,
            targetLanguage: languagePreferences.learningLanguage,
            messageLinks: createDefaultMessageLinks(snapshot),
            reason: "Local fallback segmentation for mock mode.",
        },
    ];
}

export async function segmentInquiries(
    snapshot: TranscriptSnapshot,
    modelService: LanguageModelService,
    useModel: boolean,
    languagePreferences: LanguagePreferenceSettings = DEFAULT_LANGUAGE_PREFERENCE_SETTINGS
) {
    if (!useModel) {
        return createHeuristicInquirySlices(snapshot, languagePreferences);
    }

    const output = await modelService.structuredOutput({
        schema: segmentInquiriesSchema,
        options: SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS,
        input: createSessionInquirySegmentationPrompt(
            snapshot,
            languagePreferences
        ),
    });

    console.log("[LanguageFriction][session=>inquirySlice][llm]", {
        sessionId: snapshot.sessionId,
        transcriptHash: snapshot.transcriptHash,
        output,
    });

    return normalizeInquirySlices(output, snapshot);
}
