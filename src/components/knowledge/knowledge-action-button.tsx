import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

type KnowledgeActionButtonProps = {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "secondary" | "danger";
};

export function KnowledgeActionButton({
    label,
    onPress,
    disabled,
    loading,
    variant = "primary",
}: KnowledgeActionButtonProps) {
    const isDisabled = disabled || loading;
    const isPrimary = variant === "primary";
    const isDanger = variant === "danger";

    return (
        <Pressable
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                variant === "secondary" && styles.secondaryButton,
                variant === "danger" && styles.dangerButton,
                pressed && !isDisabled && styles.pressed,
                isDisabled && styles.disabled,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={
                        isPrimary ? "#ffffff" : isDanger ? "#dc2626" : "#2f6fed"
                    }
                    size="small"
                />
            ) : null}
            <ThemedText
                type="smallBold"
                style={
                    isPrimary
                        ? styles.primaryText
                        : isDanger
                          ? styles.dangerText
                          : styles.secondaryText
                }
            >
                {label}
            </ThemedText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minHeight: 42,
        minWidth: 144,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.two,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#1f56c5",
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
        boxShadow: "0 2px 6px rgba(47, 111, 237, 0.28)",
    },
    secondaryButton: {
        borderColor: "rgba(130, 130, 145, 0.28)",
        backgroundColor: "transparent",
        boxShadow: "none",
    },
    dangerButton: {
        borderColor: "#dc2626",
        backgroundColor: "transparent",
        boxShadow: "none",
    },
    pressed: {
        opacity: 0.72,
    },
    disabled: {
        opacity: 0.52,
    },
    primaryText: {
        color: "#ffffff",
        textAlign: "center",
    },
    secondaryText: {
        color: "#2f6fed",
        textAlign: "center",
    },
    dangerText: {
        color: "#dc2626",
        textAlign: "center",
    },
});
