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
    "An Inquiry is a specific expression question, not every single message.",
    "Return an empty inquiries array when there is no durable language friction.",
    "Only reference message IDs that appear in the transcript.",
].join("\n");

export const SESSION_INQUIRY_SEGMENTATION_PROMPT_OPTIONS = {
    name: "SessionInquirySegmentation",
    description:
        "Language-learning inquiry slices extracted from one chat transcript.",
} satisfies StructuredOutputOptions;

export const INQUIRY_KNOWLEDGE_DRAFT_SYSTEM_PROMPT = [
    "Draft reusable language knowledge for one Inquiry.",
    "Do not create Pattern candidates.",
    "Use Concept for stable meanings and Expression for reusable wording.",
    "Use KnowledgePoint utterances for complete recommended sentences.",
    "Every relation must reference tempRef values from conceptCandidates or expressionCandidates.",
    "Prefer sparse evidence-based relations.",
].join("\n");

export const INQUIRY_KNOWLEDGE_DRAFT_PROMPT_OPTIONS = {
    name: "InquiryKnowledgeDraft",
    description:
        "KnowledgePoint, utterances, concept candidates, expression candidates, and relation candidates for one Inquiry.",
} satisfies StructuredOutputOptions;

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

export function createSessionInquirySegmentationPrompt(
    snapshot: TranscriptSnapshot
): CompletionInput {
    return [
        {
            role: "system",
            content: SESSION_INQUIRY_SEGMENTATION_SYSTEM_PROMPT,
        },
        {
            role: "user",
            content: `Transcript snapshot:\n${transcriptPromptPayload(snapshot)}`,
        },
    ];
}

export function createInquiryKnowledgeDraftPrompt({
    snapshot,
    inquiry,
}: {
    snapshot: TranscriptSnapshot;
    inquiry: InquirySlice;
}): CompletionInput {
    return [
        {
            role: "system",
            content: INQUIRY_KNOWLEDGE_DRAFT_SYSTEM_PROMPT,
        },
        {
            role: "user",
            content: JSON.stringify(
                {
                    transcript: snapshot,
                    inquiry,
                },
                null,
                2
            ),
        },
    ];
}
