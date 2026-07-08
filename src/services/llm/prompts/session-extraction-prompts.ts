import {
    DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    getSupportedLanguageLabel,
    type LanguagePreferenceSettings,
} from "@/constants/language-preferences";
import type {
    CompletionInput,
    StructuredOutputOptions,
} from "@/providers/language-model-provider";
import type {
    InquirySlice,
    TranscriptSnapshot,
} from "@/services/session-extraction/types";

export const SESSION_INQUIRY_SEGMENTATION_SYSTEM_PROMPT = [
    "Extract concrete language-expression inquiries from a learner chat transcript.",
    "",
    "An Inquiry is a durable question about how to express, translate, name, phrase, or distinguish a specific concept in language. It is not the same as a single message: one inquiry may span multiple turns.",
    "",
    "Return JSON with an `inquiries` array. Return an empty `inquiries` array when there is no durable language friction.",
    "",
    "Only reference message IDs that appear in the transcript.",
    "",
    "Extraction rules:",
    "",
    "1. Merge only rejected-answer clarification into one inquiry.",
    "Default to splitting learner questions into separate inquiries.",
    "The only case where multiple learner questions should be merged is when the learner clearly disagrees with, rejects, or corrects the assistant's previous answer because it did not answer what the learner truly meant, then continues clarifying that same intended question.",
    "When this happens, ignore the earlier misunderstood wording as a separate inquiry and use the learner's clarified final intent as the inquiry concept.",
    "If assistant answers are linked as evidence, use only the answer that addresses the clarified intent and was not rejected by the learner; do not treat the rejected assistant answer as the answer to the merged inquiry.",
    "The same target concept means the same intended real-world referent, function, property, distinction, phrase, or communicative goal that the learner wants to express.",
    "Two turns are not the same concept merely because the learner uses near-synonyms, because the words are dictionary-related, or because both concepts belong to the same object, domain, topic, or document.",
    "Do not merge merely because the later question adds context, asks for another wording, narrows a topic, or follows from the previous answer, unless it clearly rejects the previous answer as a misunderstanding.",
    "",
    "Example:",
    "(A Chinese speaker is asking questions about English)",
    'Learner: "\u63a5\u53e3\u600e\u4e48\u8bf4\uff1f"',
    'Assistant: "If you mean a software boundary, it is usually called an interface..."',
    'Learner: "\u5662\u6211\u8bf4\u7684\u662f\u98de\u8239\u5bf9\u63a5\u7684\u63a5\u53e3\u3002"',
    "Expected inquiry:",
    '- userNeed: how to express "\u98de\u8239\u5bf9\u63a5\u7684\u63a5\u53e3"',
    '- primaryLanguageContext: "\u7528\u6237\u60f3\u8868\u8fbe\u7684\u662f\u98de\u8239\u5bf9\u63a5\u5904\u7684\u7269\u7406\u63a5\u53e3\uff0c\u4e0d\u662f\u8f6f\u4ef6\u63a5\u53e3\u3002"',
    'Do not extract a separate inquiry for the software meaning of "\u63a5\u53e3".',
    "",
    "2. Split contextual follow-up questions when they introduce a new target concept.",
    "A later learner question can be a separate inquiry even when it depends on the previous inquiry's context.",
    "If it asks about a different concept, field, role, property, document item, phrase, or subcomponent, extract it as a separate inquiry.",
    "If two learner questions would produce different target-language expressions, extract separate inquiries unless the later question is an explicit rejected-answer clarification of the earlier question.",
    "If the learner has not clearly rejected the previous answer or clarified a misunderstanding, different expression outputs mean different inquiries.",
    'Without context, broad near-synonyms such as Chinese "\u5b54" and "\u6d1e" may point to the same general concept, but context can make them different target concepts.',
    "If the context identifies different referents or functions, such as a phone lanyard hole and an opening left for a phone speaker, split them into separate inquiries even though both are related to a phone.",
    "Preserve inherited context only as needed to make the concept clear.",
    "",
    "Example:",
    "(A Chinese speaker is asking questions about English)",
    'Learner: "\u6237\u53e3\u600e\u4e48\u8bf4\uff1f"',
    'Assistant: "In a mainland China context, it is usually `household registration`..."',
    'Learner: "\u90a3\u8fd9\u4e2a\u7b7e\u53d1\u673a\u5173\u600e\u4e48\u8bf4\uff1f"',
    "Expected inquiries:",
    '- how to express "\u6237\u53e3"',
    '- how to express "\u6237\u53e3\u7684\u7b7e\u53d1\u673a\u5173"',
    "",
    "Example:",
    "(A Chinese speaker is asking questions about English)",
    'Learner: "\u624b\u673a\u4e0a\u6302\u624b\u673a\u7ef3\u7684\u5b54\u600e\u4e48\u8bf4\uff1f"',
    'Assistant: "You could call it a lanyard hole or strap hole..."',
    'Learner: "\u90a3\u626c\u58f0\u5668\u90a3\u79cd\u9884\u7559\u7684\u6d1e\u600e\u4e48\u8bf4\uff1f"',
    "Expected inquiries:",
    '- how to express "\u624b\u673a\u4e0a\u6302\u624b\u673a\u7ef3\u7684\u5b54"',
    '- how to express "\u624b\u673a\u626c\u58f0\u5668\u9884\u7559\u7684\u6d1e"',
    "Do not merge them just because both are phone-related openings.",
    "",
    "3. Apply the boundary between merging and splitting conservatively.",
    'Do not merge merely because the messages are adjacent, because the later question uses pronouns, or because it says things like "also", "then", "what about this", or "in that case".',
    "Merge only when the later learner turn is best understood as opposing or correcting the assistant's prior answer because the prior answer missed the learner's real intent.",
    "Split when the later learner turn introduces another expression target, another expected wording, or another concrete referent, even if that target inherits topic, domain, or document context from the previous inquiry.",
    "If the transcript does not make clear whether the learner is dissatisfied with the previous answer, correcting it, refining the same concept, or asking a new related question, prefer splitting into multiple inquiries.",
    "",
    "4. Use context carefully.",
    'If a pronoun or phrase like "this", "that one", "the former", "in this case", or "the person" refers to earlier context, resolve it only from the transcript.',
    "Do not invent missing context.",
    "If the referent is unclear, keep the inquiry wording conservative.",
    "",
    "5. Ignore non-inquiries.",
    "Do not extract greetings, acknowledgements, thanks, confirmations, casual chat, or general discussion unless they contain a concrete language-expression question.",
    "",
    "6. Prefer canonical concepts over surface wording.",
    "The inquiry should describe the actual concept the learner wanted to express, not necessarily the first words they used.",
].join("\n");

export const SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS = {
    name: "SessionInquirySegmentation",
    description:
        "Language-learning inquiry slices extracted from one chat transcript.",
} satisfies StructuredOutputOptions;

export const INQUIRY_KNOWLEDGE_DRAFT_SYSTEM_PROMPT = [
    "Draft reusable language knowledge for one Inquiry.",
    "Do not create Pattern candidates.",
    "",
    "In this project, an Expression is reusable wording in a specific language and usage context: a word, phrase, collocation, short expression, or fixed wording the learner may need to recall or produce.",
    "Expression candidates should normally be written in the target language of the inquiry, because they are what the learner is learning to say or understand.",
    "",
    "In this project, a Concept is the stable meaning or real-world idea behind wording. It represents what something is, not how it is said.",
    "A Concept is not a vocabulary item by itself. It may be labeled in the learner's primary language when that best preserves the intended meaning.",
    "",
    "Be very conservative when creating Concept candidates. This app is for B2 to C1 learners, so assume they already know basic everyday concepts.",
    "Do not create Concept candidates for generic, obvious background things such as books, people, documents, places, objects, actions, or broad topics unless they are the primary friction, needed for a distinction, or necessary for future retrieval.",
    "Prefer fewer, broader Concept candidates. Merge concepts that point to the same intended meaning, and use aliases, definition, or disambiguationNote instead of separate candidates when possible.",
    "Create separate Concept candidates only when the meanings are genuinely different, contrastive, confusable, or independently useful for this learner's future review.",
    "",
    "A KnowledgePoint utterance is a complete sentence or complete wording used in this inquiry's specific context. It is stored under the KnowledgePoint as the concrete answer, alternative, contrast, incorrect attempt, or literal translation to review.",
    "Use KnowledgePoint utterances for complete target-language sentences or wordings only.",
    "Do not return learner-primary-language or source-language explanations as utterances. Put those details in the KnowledgePoint explanation, contextSnapshot, Concept labels, or notes instead.",
    "If an utterance has role incorrect or literal_translation, it must still be an attempted target-language wording, not source-language text.",
    "Every relation must reference tempRef values from conceptCandidates or expressionCandidates.",
    "Prefer sparse evidence-based relations.",
].join("\n");

export const INQUIRY_KNOWLEDGE_DRAFT_PROMPT_OPTIONS = {
    name: "InquiryKnowledgeDraft",
    description:
        "KnowledgePoint, utterances, concept candidates, expression candidates, and relation candidates for one Inquiry.",
} satisfies StructuredOutputOptions;

function languagePreferencePromptPayload(
    languagePreferences: LanguagePreferenceSettings
) {
    return {
        primaryLanguage: getSupportedLanguageLabel(
            languagePreferences.primaryLanguage
        ),
        primaryLanguageCode: languagePreferences.primaryLanguage,
        learningLanguage: getSupportedLanguageLabel(
            languagePreferences.learningLanguage
        ),
        learningLanguageCode: languagePreferences.learningLanguage,
    };
}

function transcriptPromptPayload(snapshot: TranscriptSnapshot) {
    return JSON.stringify(
        {
            ...snapshot,
            messages: snapshot.messages.map((message) => ({
                id: message.id,
                role: message.role,
                sequence: message.sequence,
                text: message.text,
                nonTextBlocks: message.nonTextBlocks,
            })),
        },
        null,
        2
    );
}

function inquiryScopedTranscriptSnapshot(
    snapshot: TranscriptSnapshot,
    inquiry: InquirySlice
): TranscriptSnapshot {
    const linkedMessageIds = new Set(
        inquiry.messageLinks.map((link) => link.messageId)
    );

    return {
        ...snapshot,
        messages: snapshot.messages.filter((message) =>
            linkedMessageIds.has(message.id)
        ),
    };
}

export function createSessionInquirySegmentationPrompt(
    snapshot: TranscriptSnapshot,
    languagePreferences: LanguagePreferenceSettings = DEFAULT_LANGUAGE_PREFERENCE_SETTINGS
): CompletionInput {
    return [
        {
            role: "system",
            content: SESSION_INQUIRY_SEGMENTATION_SYSTEM_PROMPT,
        },
        {
            role: "user",
            content: [
                "Learner language preferences:",
                JSON.stringify(
                    languagePreferencePromptPayload(languagePreferences),
                    null,
                    2
                ),
                "",
                `Transcript snapshot:\n${transcriptPromptPayload(snapshot)}`,
            ].join("\n"),
        },
    ];
}

export function createInquiryKnowledgeDraftPrompt({
    snapshot,
    inquiry,
    languagePreferences = DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
}: {
    snapshot: TranscriptSnapshot;
    inquiry: InquirySlice;
    languagePreferences?: LanguagePreferenceSettings;
}): CompletionInput {
    return [
        {
            role: "system",
            content: INQUIRY_KNOWLEDGE_DRAFT_SYSTEM_PROMPT,
        },
        {
            role: "user",
            content: [
                "Learner language context:",
                JSON.stringify(
                    {
                        ...languagePreferencePromptPayload(languagePreferences),
                        userLanguage: getSupportedLanguageLabel(
                            languagePreferences.primaryLanguage
                        ),
                        userLanguageCode: languagePreferences.primaryLanguage,
                        targetLanguage: inquiry.targetLanguage,
                        targetLanguageNote:
                            "Use this inquiry targetLanguage for utterances and target-language expressions.",
                    },
                    null,
                    2
                ),
                "",
                "Extraction input:",
                JSON.stringify(
                    {
                        transcript: inquiryScopedTranscriptSnapshot(
                            snapshot,
                            inquiry
                        ),
                        transcriptScope:
                            "Only messages linked by inquiry.messageLinks are provided for this knowledge draft.",
                        inquiry,
                    },
                    null,
                    2
                ),
            ].join("\n"),
        },
    ];
}
