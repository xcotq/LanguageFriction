import {
    AiSdkProvider,
    type LanguageModelProviderOptions,
} from "@/providers/language-model-provider";
import {
    defaultStoredLanguageModelSettings,
    isStoredLanguageModelSettingsReady,
} from "@/providers/language-model-settings-store";
import type { LanguageModelService } from "@/services/llm/language-model-service";
import {
    getTestEnvNumber,
    getTestEnvValue,
    loadTestEnv,
    type TestEnv,
} from "@/test-utils/env";

const envKeys = {
    endpoint: [
        "LANGUAGE_FRICTION_TEST_LLM_ENDPOINT",
        "LANGUAGE_MODEL_ENDPOINT",
    ],
    apiKey: [
        "LANGUAGE_FRICTION_TEST_LLM_API_KEY",
        "LANGUAGE_MODEL_API_KEY",
        "OPENAI_API_KEY",
    ],
    modelName: [
        "LANGUAGE_FRICTION_TEST_LLM_MODEL",
        "LANGUAGE_MODEL_NAME",
        "OPENAI_MODEL",
    ],
    temperature: ["LANGUAGE_FRICTION_TEST_LLM_TEMPERATURE"],
    maxRetries: ["LANGUAGE_FRICTION_TEST_LLM_MAX_RETRIES"],
    timeout: ["LANGUAGE_FRICTION_TEST_LLM_TIMEOUT_MS"],
} as const;

function requireFetch() {
    if (!globalThis.fetch) {
        throw new Error("globalThis.fetch is required to run LLM tests.");
    }

    return globalThis.fetch.bind(globalThis);
}

export function getTestLanguageModelSettingsFromEnv(
    env: TestEnv = loadTestEnv()
): LanguageModelProviderOptions {
    return {
        endpoint:
            getTestEnvValue(envKeys.endpoint, env) ??
            defaultStoredLanguageModelSettings.endpoint,
        apiKey: getTestEnvValue(envKeys.apiKey, env) ?? "",
        modelName:
            getTestEnvValue(envKeys.modelName, env) ??
            defaultStoredLanguageModelSettings.modelName,
        temperature: getTestEnvNumber(envKeys.temperature, env) ?? 0,
        maxRetries: getTestEnvNumber(envKeys.maxRetries, env) ?? 1,
        timeout: getTestEnvNumber(envKeys.timeout, env) ?? 60_000,
        fetch: requireFetch(),
    };
}

export function requireTestLanguageModelSettingsFromEnv(
    env: TestEnv = loadTestEnv()
) {
    const settings = getTestLanguageModelSettingsFromEnv(env);

    if (!isStoredLanguageModelSettingsReady(settings)) {
        throw new Error(
            [
                "LLM test settings are incomplete.",
                "Copy .env.test.example to .env.test.local and set LANGUAGE_FRICTION_TEST_LLM_API_KEY, or set OPENAI_API_KEY.",
                "Optional: LANGUAGE_FRICTION_TEST_LLM_ENDPOINT and LANGUAGE_FRICTION_TEST_LLM_MODEL.",
            ].join(" ")
        );
    }

    return settings;
}

export function createTestLanguageModelProvider(
    settings = requireTestLanguageModelSettingsFromEnv()
) {
    return new AiSdkProvider(settings);
}

export function createTestLanguageModelService(
    provider = createTestLanguageModelProvider()
): LanguageModelService {
    const service: LanguageModelService = {
        chat(request) {
            return provider.complete(request.input);
        },

        structuredOutput(request) {
            return provider.invokeStructured(
                request.input,
                request.schema,
                request.options
            );
        },

        runWorkflow(request) {
            return request.run(service);
        },
    };

    return service;
}
