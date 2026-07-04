import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

type KnowledgeActionButtonProps = {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "secondary";
};

export function KnowledgeActionButton({
    label,
    onPress,
    disabled,
    loading,
    variant = "primary",
}: KnowledgeActionButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <Pressable
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                variant === "secondary" && styles.secondaryButton,
                pressed && !isDisabled && styles.pressed,
                isDisabled && styles.disabled,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === "primary" ? "#ffffff" : "#2f6fed"}
                    size="small"
                />
            ) : null}
            <ThemedText
                type="smallBold"
                style={
                    variant === "primary"
                        ? styles.primaryText
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
});
