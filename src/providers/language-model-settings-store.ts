import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type StoredLanguageModelSettings = {
  endpoint: string;
  apiKey: string;
  modelName: string;
};

const storageKeys = {
  endpoint: "languagefriction.model.endpoint",
  apiKey: "languagefriction.model.apiKey",
  modelName: "languagefriction.model.modelName",
} as const;

export const defaultStoredLanguageModelSettings: StoredLanguageModelSettings = {
  endpoint: "https://api.openai.com/v1",
  apiKey: "",
  modelName: "gpt-4.1-mini",
};

async function getItem(key: string) {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function loadStoredLanguageModelSettings(): Promise<StoredLanguageModelSettings> {
  const [endpoint, apiKey, modelName] = await Promise.all([
    getItem(storageKeys.endpoint),
    getItem(storageKeys.apiKey),
    getItem(storageKeys.modelName),
  ]);

  return {
    endpoint: endpoint ?? defaultStoredLanguageModelSettings.endpoint,
    apiKey: apiKey ?? defaultStoredLanguageModelSettings.apiKey,
    modelName: modelName ?? defaultStoredLanguageModelSettings.modelName,
  };
}

export async function saveStoredLanguageModelSettings(
  settings: StoredLanguageModelSettings,
) {
  await Promise.all([
    setItem(storageKeys.endpoint, settings.endpoint.trim()),
    setItem(storageKeys.apiKey, settings.apiKey.trim()),
    setItem(storageKeys.modelName, settings.modelName.trim()),
  ]);
}

export function isStoredLanguageModelSettingsReady(
  settings: StoredLanguageModelSettings,
) {
  return Boolean(
    settings.endpoint.trim() &&
      settings.apiKey.trim() &&
      settings.modelName.trim(),
  );
}
