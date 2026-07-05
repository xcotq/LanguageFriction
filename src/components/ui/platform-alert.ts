import { Alert, Platform } from "react-native";

function formatWebDialogText(title: string, message?: string) {
    return message ? `${title}\n\n${message}` : title;
}

export function showAlert(title: string, message?: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(formatWebDialogText(title, message));
        return;
    }

    Alert.alert(title, message);
}

export function showConfirm({
    title,
    message,
    confirmText = "OK",
    cancelText = "Cancel",
    destructive = false,
}: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}): Promise<boolean> {
    if (Platform.OS === "web" && typeof window !== "undefined") {
        return Promise.resolve(
            window.confirm(formatWebDialogText(title, message))
        );
    }

    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                {
                    text: cancelText,
                    style: "cancel",
                    onPress: () => resolve(false),
                },
                {
                    text: confirmText,
                    style: destructive ? "destructive" : "default",
                    onPress: () => resolve(true),
                },
            ],
            {
                cancelable: true,
                onDismiss: () => resolve(false),
            }
        );
    });
}
