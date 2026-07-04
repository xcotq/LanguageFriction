import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

type KnowledgeDetailSectionProps = PropsWithChildren<{
    title: string;
}>;

export function KnowledgeDetailSection({
    title,
    children,
}: KnowledgeDetailSectionProps) {
    return (
        <View style={styles.section}>
            <ThemedText selectable type="smallBold">
                {title}
            </ThemedText>
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        gap: Spacing.two,
    },
    content: {
        gap: Spacing.two,
    },
});
