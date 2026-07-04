import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionListItem } from "@/components/chat/session-list-item";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing, TopTabInset } from "@/constants/theme";
import { useRepositories } from "@/data/repositories";
import { useTheme } from "@/hooks/use-theme";
import type { ChatSession } from "@/types/domain";

export default function HistoryScreen() {
    const router = useRouter();
    const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { chatSession: repository } = useRepositories();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const selectedSessionId =
        typeof sessionId === "string" && sessionId.trim()
            ? sessionId
            : undefined;

    useEffect(() => {
        let isMounted = true;

        async function loadSessions() {
            const nextSessions = await repository.listChatSessions("mock-user");

            if (isMounted) {
                setSessions(nextSessions);
                setIsLoading(false);
            }
        }

        loadSessions().catch((error) => {
            console.error("Failed to load session history", error);
            if (isMounted) {
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [repository]);

    const handleDeleteSession = useCallback(
        (session: ChatSession) => {
            Alert.alert(
                "Delete session?",
                "This will remove the conversation and its messages.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                await repository.deleteSession(session.id);
                                const nextSessions = sessions.filter(
                                    (item) => item.id !== session.id
                                );

                                setSessions(nextSessions);

                                if (session.id === selectedSessionId) {
                                    const nextSelectedSession = nextSessions[0];
                                    router.replace(
                                        nextSelectedSession
                                            ? {
                                                  pathname: "/history",
                                                  params: {
                                                      sessionId:
                                                          nextSelectedSession.id,
                                                  },
                                              }
                                            : "/history"
                                    );
                                }
                            } catch (error) {
                                console.error(
                                    "Failed to delete session",
                                    error
                                );
                                Alert.alert(
                                    "Delete failed",
                                    "The session could not be deleted."
                                );
                            }
                        },
                    },
                ]
            );
        },
        [repository, router, selectedSessionId, sessions]
    );

    return (
        <ScrollView
            style={[styles.scrollView, { backgroundColor: theme.background }]}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
                styles.content,
                {
                    paddingTop: insets.top + TopTabInset,
                    paddingBottom: insets.bottom + Spacing.four,
                },
            ]}
        >
            <ThemedView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <ThemedText selectable type="subtitle">
                            History
                        </ThemedText>
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            {isLoading
                                ? "Loading sessions"
                                : `${sessions.length} sessions`}
                        </ThemedText>
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                            router.replace({
                                pathname: "/",
                                params: selectedSessionId
                                    ? { sessionId: selectedSessionId }
                                    : undefined,
                            })
                        }
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            pressed && styles.pressed,
                        ]}
                    >
                        <ThemedText
                            type="smallBold"
                            style={styles.secondaryButtonText}
                        >
                            Back to Chat
                        </ThemedText>
                    </Pressable>
                </View>

                <View style={styles.sessionList}>
                    {sessions.map((session) => (
                        <SessionListItem
                            key={session.id}
                            session={session}
                            isSelected={session.id === selectedSessionId}
                            onPress={() =>
                                router.replace({
                                    pathname: "/",
                                    params: { sessionId: session.id },
                                })
                            }
                            onDelete={() => handleDeleteSession(session)}
                        />
                    ))}
                    {!isLoading && sessions.length === 0 ? (
                        <ThemedText
                            selectable
                            type="small"
                            themeColor="textSecondary"
                        >
                            No sessions yet.
                        </ThemedText>
                    ) : null}
                </View>
            </ThemedView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: Spacing.three,
        alignItems: "center",
    },
    container: {
        width: "100%",
        maxWidth: MaxContentWidth,
        gap: Spacing.three,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.three,
    },
    headerText: {
        flex: 1,
        gap: Spacing.one,
    },
    pressed: {
        opacity: 0.72,
    },
    secondaryButton: {
        minHeight: 38,
        minWidth: 112,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#1f56c5",
        backgroundColor: "#2f6fed",
        paddingHorizontal: Spacing.three,
        boxShadow: "0 2px 6px rgba(47, 111, 237, 0.28)",
    },
    secondaryButtonText: {
        color: "#ffffff",
    },
    sessionList: {
        gap: Spacing.two,
    },
});
