import { existsSync } from "fs";
import path from "path";

import { config } from "dotenv";

export type TestEnv = Record<string, string | undefined>;

const testEnvFiles = [
    ".env.test.local",
    ".env.test",
    ".env.local",
    ".env",
] as const;

let loaded = false;

function projectRoot() {
    return process.cwd();
}

export function loadTestEnv() {
    if (loaded) {
        return process.env as TestEnv;
    }

    for (const fileName of testEnvFiles) {
        const envPath = path.join(projectRoot(), fileName);

        if (existsSync(envPath)) {
            config({ path: envPath, override: false, quiet: true });
        }
    }

    loaded = true;
    return process.env as TestEnv;
}

export function getTestEnvValue(
    keys: readonly string[],
    env: TestEnv = loadTestEnv()
) {
    for (const key of keys) {
        const value = env[key]?.trim();

        if (value) {
            return value;
        }
    }

    return undefined;
}

export function getTestEnvNumber(
    keys: readonly string[],
    env: TestEnv = loadTestEnv()
) {
    const rawValue = getTestEnvValue(keys, env);
    const value = rawValue == null ? NaN : Number(rawValue);

    return Number.isFinite(value) ? value : undefined;
}
