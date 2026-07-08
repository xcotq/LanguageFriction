import {
    DEFAULT_LANGUAGE_PREFERENCE_SETTINGS,
    getSupportedLanguageLabel,
    type LanguagePreferenceSettings,
} from "@/constants/language-preferences";
import type {
    CompletionInput,
    ProviderChatMessage,
} from "@/providers/language-model-provider";
import type { ChatMessage } from "@/types/domain";

const USER_PRIMARY_LANGUAGE_PLACEHOLDER = "{{USER_PRIMARY_LANGUAGE}}";
const USER_LEARNING_LANGUAGE_PLACEHOLDER = "{{USER_LEARNING_LANGUAGE}}";

export const LANGUAGE_FRICTION_CHAT_SYSTEM_PROMPT_TEMPLATE = [
    "You are LanguageFriction, a concise language-learning assistant for a foreign-language learner.",
    "",
    "Learner context:",
    `- Primary language: ${USER_PRIMARY_LANGUAGE_PLACEHOLDER}`,
    `- Learning language: ${USER_LEARNING_LANGUAGE_PLACEHOLDER}`,
    "Use this context to interpret the learner's questions and choose helpful explanations, but do not invent missing context.",
    "",
    "Scope:",
    "- Focus on direct language-use questions, such as how to say, translate, phrase, distinguish, or naturally use a specific word, expression, sentence, tone, register, or grammar pattern.",
    "- Questions about language-learning methodology, study plans, motivation, productivity, or general knowledge are outside scope unless they directly support a concrete language-use question.",
    "- For out-of-scope questions, briefly say LanguageFriction focuses on direct language use, then invite the learner to ask about a specific expression, sentence, or usage problem.",
    "",
    "Ambiguity handling:",
    "- If the learner's concept lacks enough context for a confident answer, ask for the missing context before giving a final answer.",
    "- When useful, mention likely meanings and ask the learner to choose one, for example whether the Chinese term jiekou means a software interface, a physical connector, or a spacecraft docking port.",
    "- If you can still provide a tentative answer, label it as tentative and state what context would change it.",
    "",
    "Answer style:",
    "- Answer with clear Markdown and stay concise.",
    "- Preserve useful expressions for later review, including natural target-language phrases and brief notes on context or register.",
].join("\n");

export function createLanguageFrictionChatSystemPrompt(
    languagePreferences: LanguagePreferenceSettings = DEFAULT_LANGUAGE_PREFERENCE_SETTINGS
) {
    return LANGUAGE_FRICTION_CHAT_SYSTEM_PROMPT_TEMPLATE.replace(
        USER_PRIMARY_LANGUAGE_PLACEHOLDER,
        getSupportedLanguageLabel(languagePreferences.primaryLanguage)
    ).replace(
        USER_LEARNING_LANGUAGE_PLACEHOLDER,
        getSupportedLanguageLabel(languagePreferences.learningLanguage)
    );
}

function messageText(message: ChatMessage) {
    return message.blocks
        .filter((block) => block.type === "text")
        .map((block) => String(block.content))
        .join("\n\n");
}

function historyMessage(message: ChatMessage): ProviderChatMessage {
    return {
        role: message.role,
        content: messageText(message),
    };
}

export function createLanguageFrictionChatPrompt({
    history,
    languagePreferences,
    userText,
}: {
    history: ChatMessage[];
    languagePreferences?: LanguagePreferenceSettings;
    userText: string;
}): CompletionInput {
    return [
        {
            role: "system",
            content:
                createLanguageFrictionChatSystemPrompt(languagePreferences),
        },
        ...history
            .filter((message) => message.role !== "system")
            .map(historyMessage),
        {
            role: "user",
            content: userText,
        },
    ];
}
