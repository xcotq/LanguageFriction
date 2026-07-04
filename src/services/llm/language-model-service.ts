import {
    complete,
    invokeStructured,
    type CompletionInput,
    type StructuredOutputOptions,
    type StructuredOutputSchema,
} from "@/providers/language-model-provider";

export type ChatCompletionRequest = {
    input: CompletionInput;
};

export type StructuredOutputRequest<Output extends Record<string, unknown>> = {
    input: CompletionInput;
    schema: StructuredOutputSchema<Output>;
    options?: StructuredOutputOptions;
};

export type WorkflowRequest<Output extends Record<string, unknown>> = {
    run: (service: LanguageModelService) => Promise<Output>;
};

export type LanguageModelService = {
    chat(request: ChatCompletionRequest): Promise<string>;
    structuredOutput<Output extends Record<string, unknown>>(
        request: StructuredOutputRequest<Output>
    ): Promise<Output>;
    runWorkflow<Output extends Record<string, unknown>>(
        request: WorkflowRequest<Output>
    ): Promise<Output>;
};

export const languageModelService: LanguageModelService = {
    chat(request) {
        return complete(request.input);
    },

    structuredOutput(request) {
        return invokeStructured(request.input, request.schema, request.options);
    },

    runWorkflow(request) {
        return request.run(languageModelService);
    },
};
