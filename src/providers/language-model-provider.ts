import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { fetch as expoFetch } from "expo/fetch";
import {
    Output,
    generateText,
    streamText,
    type FlexibleSchema,
    type LanguageModel,
    type ModelMessage,
} from "ai";

import {
    defaultStoredLanguageModelSettings,
    isStoredLanguageModelSettingsReady,
    loadStoredLanguageModelSettings,
    saveStoredLanguageModelSettings,
    type StoredLanguageModelSettings,
} from "@/providers/language-model-settings-store";

export type ProviderChatRole = "system" | "user" | "assistant";

export type ProviderChatMessage = {
    role: ProviderChatRole;
    content: string;
};

export type CompletionInput = string | ProviderChatMessage[];

export type LanguageModelProviderOptions = StoredLanguageModelSettings & {
    temperature?: number;
    maxRetries?: number;
    timeout?: number;
    fetch?: typeof globalThis.fetch;
};

export type LanguageModelSettings = StoredLanguageModelSettings;

export const defaultLanguageModelSettings: LanguageModelSettings =
    defaultStoredLanguageModelSettings;

export type LanguageModelStatus = {
    configured: boolean;
    modelName: string;
    label: string;
};

export type StructuredOutputSchema<
    Output extends Record<string, unknown> = Record<string, unknown>,
> = FlexibleSchema<Output>;

export type StructuredOutputOptions = {
    name?: string;
    description?: string;
};

export type CompletionModel = {
    invoke(input: CompletionInput): Promise<string>;
    stream(input: CompletionInput): Promise<AsyncIterable<string>>;
};

export type StructuredModel<Output extends Record<string, unknown>> = {
    invoke(input: CompletionInput): Promise<Output>;
};

export type AgentOptions = {
    systemPrompt?: string;
    tools?: unknown[];
    responseFormat?: unknown;
};

type BasicAgentInput = CompletionInput | { messages: CompletionInput };

export type LanguageModelAgent = {
    invoke(input: BasicAgentInput): Promise<string>;
    stream(input: BasicAgentInput): Promise<AsyncIterable<string>>;
};

let globalProviderPromise: Promise<AiSdkProvider> | undefined;

function normalizeEndpoint(endpoint: string) {
    return endpoint.trim().replace(/\/+$/, "");
}

function normalizeMessages(input: CompletionInput): ModelMessage[] | string {
    if (typeof input === "string") {
        return input;
    }

    return input.map((message) => ({
        role: message.role,
        content: message.content,
    }));
}

function normalizeAgentInput(
    input: BasicAgentInput,
    systemPrompt?: string
): ModelMessage[] | string {
    const messages =
        typeof input === "object" &&
        !Array.isArray(input) &&
        "messages" in input
            ? normalizeMessages(input.messages)
            : normalizeMessages(input);

    if (!systemPrompt) {
        return messages;
    }

    if (typeof messages === "string") {
        return [
            { role: "system", content: systemPrompt },
            { role: "user", content: messages },
        ];
    }

    return [{ role: "system", content: systemPrompt }, ...messages];
}

function toPromptOptions(input: ModelMessage[] | string) {
    if (typeof input === "string") {
        return { prompt: input };
    }

    return {
        allowSystemInMessages: true,
        messages: input,
    };
}

export class AiSdkProvider {
    private readonly config: LanguageModelProviderOptions;

    private readonly model: LanguageModel;

    constructor(config: LanguageModelProviderOptions) {
        if (!isStoredLanguageModelSettingsReady(config)) {
            throw new Error(
                "Model endpoint, API key, and model name are required."
            );
        }

        this.config = {
            ...config,
            endpoint: normalizeEndpoint(config.endpoint),
            apiKey: config.apiKey.trim(),
            modelName: config.modelName.trim(),
        };

        const provider = createOpenAICompatible({
            name: "language-friction",
            baseURL: this.config.endpoint,
            apiKey: this.config.apiKey,
            fetch:
                this.config.fetch ??
                (expoFetch as unknown as typeof globalThis.fetch),
            supportsStructuredOutputs: true,
        });

        this.model = provider(this.config.modelName);
    }

    static async fromStoredConfig(
        overrides: Partial<LanguageModelProviderOptions> = {}
    ) {
        const storedConfig = await loadStoredLanguageModelSettings();

        return new AiSdkProvider({
            ...storedConfig,
            ...overrides,
        });
    }

    getModel() {
        return this.getCompletionModel();
    }

    getCompletionModel(): CompletionModel {
        return {
            invoke: (input) => this.complete(input),
            stream: (input) => this.stream(input),
        };
    }

    getStructuredModel<Output extends Record<string, unknown>>(
        schema: StructuredOutputSchema<Output>,
        options: StructuredOutputOptions = {}
    ): StructuredModel<Output> {
        return {
            invoke: (input) =>
                this.invokeStructured<Output>(input, schema, options),
        };
    }

    getAgent(options: AgentOptions = {}): LanguageModelAgent {
        if (options.responseFormat || options.tools?.length) {
            throw new Error(
                "AI SDK agents with tools or responseFormat are not enabled in this provider wrapper yet."
            );
        }

        return {
            invoke: (input) =>
                this.complete(normalizeAgentInput(input, options.systemPrompt)),
            stream: (input) =>
                this.stream(normalizeAgentInput(input, options.systemPrompt)),
        };
    }

    async complete(input: CompletionInput | ModelMessage[] | string) {
        const { text } = await generateText({
            model: this.model,
            ...toPromptOptions(
                typeof input === "string" || Array.isArray(input)
                    ? normalizeMessages(input as CompletionInput)
                    : input
            ),
            ...this.getCallSettings(),
        });

        return text;
    }

    async completeText(prompt: string) {
        return this.complete(prompt);
    }

    async stream(input: CompletionInput | ModelMessage[] | string) {
        const result = streamText({
            model: this.model,
            ...toPromptOptions(
                typeof input === "string" || Array.isArray(input)
                    ? normalizeMessages(input as CompletionInput)
                    : input
            ),
            ...this.getCallSettings(),
        });

        return result.textStream;
    }

    async invokeStructured<OutputValue extends Record<string, unknown>>(
        input: CompletionInput | ModelMessage[] | string,
        schema: StructuredOutputSchema<OutputValue>,
        options: StructuredOutputOptions = {}
    ): Promise<OutputValue> {
        const { output } = await generateText({
            model: this.model,
            ...toPromptOptions(
                typeof input === "string" || Array.isArray(input)
                    ? normalizeMessages(input as CompletionInput)
                    : input
            ),
            output: Output.object({
                schema,
                name: options.name,
                description: options.description,
            }),
            providerOptions: {
                openaiCompatible: {
                    strictJsonSchema: true,
                },
            },
            ...this.getCallSettings(),
        });

        return output;
    }

    private getCallSettings() {
        return {
            temperature: this.config.temperature,
            maxRetries: this.config.maxRetries,
            timeout: this.config.timeout,
        };
    }
}

export async function loadLanguageModelSettings(): Promise<LanguageModelSettings> {
    return loadStoredLanguageModelSettings();
}

export async function saveLanguageModelSettings(
    settings: LanguageModelSettings
) {
    await saveStoredLanguageModelSettings(settings);
    resetLanguageModelProvider();
}

export function isLanguageModelConfigured(settings: LanguageModelSettings) {
    return isStoredLanguageModelSettingsReady(settings);
}

export async function getLanguageModelStatus() {
    const settings = await loadLanguageModelSettings();
    const configured = isLanguageModelConfigured(settings);

    return {
        configured,
        modelName: settings.modelName,
        label: configured ? settings.modelName : "Mock mode",
    };
}

export function resetLanguageModelProvider() {
    globalProviderPromise = undefined;
}

async function getAiSdkProvider(
    overrides?: Partial<LanguageModelProviderOptions>
) {
    if (overrides && Object.keys(overrides).length > 0) {
        return AiSdkProvider.fromStoredConfig(overrides);
    }

    globalProviderPromise ??= AiSdkProvider.fromStoredConfig();

    return globalProviderPromise;
}

export async function getCompletionModel() {
    const provider = await getAiSdkProvider();

    return provider.getCompletionModel();
}

export async function getModel() {
    return getCompletionModel();
}

export async function getStructuredModel<
    Output extends Record<string, unknown>,
>(schema: StructuredOutputSchema<Output>, options?: StructuredOutputOptions) {
    const provider = await getAiSdkProvider();

    return provider.getStructuredModel<Output>(schema, options);
}

export async function getAgent(options?: AgentOptions) {
    const provider = await getAiSdkProvider();

    return provider.getAgent(options);
}

export async function complete(input: CompletionInput) {
    const provider = await getAiSdkProvider();

    return provider.complete(input);
}

export async function completeText(prompt: string) {
    return complete(prompt);
}

export async function invokeStructured<Output extends Record<string, unknown>>(
    input: CompletionInput,
    schema: StructuredOutputSchema<Output>,
    options?: StructuredOutputOptions
) {
    const provider = await getAiSdkProvider();

    return provider.invokeStructured<Output>(input, schema, options);
}
