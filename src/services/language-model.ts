import type { LanguagePreferenceSettings } from "@/constants/language-preferences";
import type { ChatMessage } from "@/types/domain";
import { languageModelService } from "@/services/llm/language-model-service";
import { createLanguageFrictionChatPrompt } from "@/services/llm/prompts/language-friction-chat-prompts";

export async function sendLanguageFrictionMessage(
    history: ChatMessage[],
    userText: string,
    languagePreferences?: LanguagePreferenceSettings
) {
    return languageModelService.chat({
        input: createLanguageFrictionChatPrompt({
            history,
            languagePreferences,
            userText,
        }),
    });
}
