import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";

import {
    formatPracticeValue,
    shouldRenderPracticeValueAsCode,
} from "./practice-format";

type PracticeValueBlockProps = {
    title: string;
    value: unknown;
    emptyText?: string;
    preferText?: boolean;
};

export function PracticeValueBlock({
    title,
    value,
    emptyText = "Not available.",
    preferText = false,
}: PracticeValueBlockProps) {
    const formatted = formatPracticeValue(value, { preferText });
    const isEmpty = !formatted;
    const renderAsCode = shouldRenderPracticeValueAsCode(value, { preferText });

    return (
        <View style={styles.section}>
            <ThemedText selectable type="smallBold">
                {title}
            </ThemedText>
            <ThemedView
                type="backgroundElement"
                style={[styles.block, renderAsCode && styles.codeBlock]}
            >
                <ThemedText
                    selectable
                    type={renderAsCode ? "code" : "small"}
                    themeColor={isEmpty ? "textSecondary" : undefined}
                >
                    {isEmpty ? emptyText : formatted}
                </ThemedText>
            </ThemedView>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        gap: Spacing.two,
    },
    block: {
        padding: Spacing.three,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.18)",
    },
    codeBlock: {
        gap: Spacing.one,
    },
});
