import Markdown from "react-native-markdown-display";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { formatPracticePromptSummary, isRecord } from "./practice-format";
import { PracticeValueBlock } from "./practice-value-block";

type PromptDisplayBlockContent = {
    format?: unknown;
    text?: unknown;
    uri?: unknown;
    dataJson?: unknown;
    altText?: unknown;
};

type PromptDisplayBlock = {
    type?: unknown;
    label?: unknown;
    content?: unknown;
};

function asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getPromptDisplayBlocks(prompt: unknown): PromptDisplayBlock[] {
    if (!isRecord(prompt) || !Array.isArray(prompt.displayBlocks)) {
        return [];
    }

    return prompt.displayBlocks.filter(isRecord);
}

function getPromptMarkdown(prompt: unknown) {
    return isRecord(prompt) ? asString(prompt.markdown) : undefined;
}

function getBlockContentText(content: PromptDisplayBlockContent) {
    return (
        asString(content.text) ??
        asString(content.dataJson) ??
        asString(content.uri) ??
        asString(content.altText) ??
        ""
    );
}

function PracticeMarkdown({ children }: { children: string }) {
    const theme = useTheme();

    return (
        <Markdown
            style={{
                body: {
                    color: theme.text,
                    fontSize: 16,
                    lineHeight: 24,
                    fontWeight: "500",
                },
                heading1: {
                    color: theme.text,
                    fontSize: 24,
                    lineHeight: 30,
                    fontWeight: "700",
                    marginTop: 0,
                    marginBottom: 8,
                },
                heading2: {
                    color: theme.text,
                    fontSize: 20,
                    lineHeight: 26,
                    fontWeight: "700",
                    marginTop: 0,
                    marginBottom: 8,
                },
                paragraph: {
                    marginTop: 0,
                    marginBottom: 10,
                },
                bullet_list: {
                    marginBottom: 10,
                },
                ordered_list: {
                    marginBottom: 10,
                },
                blockquote: {
                    borderLeftColor: theme.backgroundElement,
                    borderLeftWidth: 3,
                    paddingLeft: 10,
                    color: theme.textSecondary,
                },
                code_inline: {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderRadius: 6,
                    fontFamily: Fonts.mono,
                    fontSize: 14,
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                },
                fence: {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderRadius: 8,
                    fontFamily: Fonts.mono,
                    fontSize: 13,
                    lineHeight: 19,
                    padding: 10,
                },
                strong: {
                    color: theme.text,
                    fontWeight: "700",
                },
                em: {
                    color: theme.text,
                    fontStyle: "italic",
                },
            }}
        >
            {children}
        </Markdown>
    );
}

function shouldRenderBlockAsCode(content: PromptDisplayBlockContent) {
    return asString(content.format) === "json";
}

function PromptBlock({ block }: { block: PromptDisplayBlock }) {
    const content = isRecord(block.content)
        ? (block.content as PromptDisplayBlockContent)
        : {};
    const label = asString(block.label);
    const text = getBlockContentText(content);
    const renderAsCode = shouldRenderBlockAsCode(content);

    if (!label && !text) {
        return null;
    }

    return (
        <ThemedView type="backgroundElement" style={styles.block}>
            {label ? (
                <ThemedText selectable type="smallBold">
                    {label}
                </ThemedText>
            ) : null}
            {text ? (
                <ThemedText selectable type={renderAsCode ? "code" : "small"}>
                    {text}
                </ThemedText>
            ) : null}
        </ThemedView>
    );
}

export function PracticePromptDisplay({ prompt }: { prompt: unknown }) {
    const markdown = getPromptMarkdown(prompt);
    const blocks = getPromptDisplayBlocks(prompt);

    if (isRecord(prompt) && markdown) {
        return (
            <View style={styles.section}>
                <ThemedText selectable type="smallBold">
                    Prompt
                </ThemedText>
                <ThemedView
                    type="backgroundSelected"
                    style={styles.promptSurface}
                >
                    <PracticeMarkdown>{markdown}</PracticeMarkdown>
                </ThemedView>
            </View>
        );
    }

    if (!isRecord(prompt) || blocks.length === 0) {
        return <PracticeValueBlock title="Prompt" value={prompt} />;
    }

    return (
        <View style={styles.section}>
            <ThemedText selectable type="smallBold">
                Prompt
            </ThemedText>
            <ThemedView type="backgroundSelected" style={styles.promptSurface}>
                <ThemedText selectable type="subtitle">
                    {formatPracticePromptSummary(prompt)}
                </ThemedText>
                {asString(prompt.instruction) ? (
                    <ThemedText selectable type="small">
                        {asString(prompt.instruction)}
                    </ThemedText>
                ) : null}
                <View style={styles.blockList}>
                    {blocks.map((block, index) => (
                        <PromptBlock
                            key={`${asString(block.label) ?? "block"}:${index}`}
                            block={block}
                        />
                    ))}
                </View>
            </ThemedView>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        gap: Spacing.two,
    },
    promptSurface: {
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    blockList: {
        gap: Spacing.two,
    },
    block: {
        gap: Spacing.one,
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.16)",
    },
});
