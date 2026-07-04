import {
    TextDecoderStream,
    TextEncoderStream,
} from "@stardazed/streams-text-encoding";
import structuredClonePolyfill from "@ungap/structured-clone";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

type PolyfilledGlobal = typeof globalThis & {
    TextDecoderStream?: typeof TextDecoderStream;
    TextEncoderStream?: typeof TextEncoderStream;
    fetch?: typeof globalThis.fetch;
    structuredClone?: typeof structuredClonePolyfill;
};

if (Platform.OS !== "web") {
    const polyfilledGlobal = globalThis as PolyfilledGlobal;

    polyfilledGlobal.structuredClone ??= structuredClonePolyfill;
    polyfilledGlobal.TextEncoderStream ??= TextEncoderStream;
    polyfilledGlobal.TextDecoderStream ??= TextDecoderStream;
    polyfilledGlobal.fetch = expoFetch as unknown as typeof globalThis.fetch;
}
