import { Link, Slot, type Href, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { PracticeDueReminderButton } from "@/components/practice/practice-due-reminder-button";
import { MaxContentWidth, Spacing } from "@/constants/theme";

export default function AppTabs() {
    const pathname = usePathname();
    const chatFocused = pathname === "/" || pathname.startsWith("/history");
    const knowledgeFocused = pathname.startsWith("/knowledge");
    const settingsFocused = pathname.startsWith("/settings");

    return (
        <View style={styles.shell}>
            <Slot />
            <CustomTabList>
                <TabButton href="/" isFocused={chatFocused}>
                    Chat
                </TabButton>
                <TabButton href="/knowledge" isFocused={knowledgeFocused}>
                    Knowledge
                </TabButton>
                <TabButton href="/settings" isFocused={settingsFocused}>
                    Settings
                </TabButton>
            </CustomTabList>
        </View>
    );
}

export function TabButton({
    children,
    href,
    isFocused,
}: {
    children: string;
    href: string;
    isFocused: boolean;
}) {
    return (
        <Link href={href as Href} asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                    type={
                        isFocused ? "backgroundSelected" : "backgroundElement"
                    }
                    style={styles.tabButtonView}
                >
                    <ThemedText
                        type="small"
                        themeColor={isFocused ? "text" : "textSecondary"}
                    >
                        {children}
                    </ThemedText>
                </ThemedView>
            </Pressable>
        </Link>
    );
}

export function CustomTabList({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const showBrand = width >= 430;

    return (
        <View
            style={[
                styles.tabListContainer,
                {
                    paddingTop: insets.top + Spacing.two,
                },
            ]}
        >
            <ThemedView type="backgroundElement" style={styles.innerContainer}>
                {showBrand ? (
                    <ThemedText type="smallBold" style={styles.brandText}>
                        LanguageFriction
                    </ThemedText>
                ) : null}

                <PracticeDueReminderButton />
                {children}
            </ThemedView>
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        flex: 1,
    },
    tabListContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: Spacing.three,
        paddingBottom: Spacing.two,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
    },
    innerContainer: {
        paddingVertical: Spacing.two,
        paddingHorizontal: Spacing.four,
        borderRadius: Spacing.three,
        flexDirection: "row",
        alignItems: "center",
        flexGrow: 1,
        gap: Spacing.two,
        maxWidth: MaxContentWidth,
        borderWidth: 1,
        borderColor: "rgba(130, 130, 145, 0.2)",
    },
    brandText: {
        marginRight: "auto",
    },
    pressed: {
        opacity: 0.7,
    },
    tabButtonView: {
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.two,
    },
});
