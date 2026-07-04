const fs = require("fs");
const path = require("path");

const aiPackageRoot = path.join(__dirname, "..", "node_modules", "ai");
const files = [
    path.join(aiPackageRoot, "dist", "index.js"),
    path.join(aiPackageRoot, "dist", "internal", "index.js"),
];

const dynamicImportSnippet = `    diagnosticsChannelPromise = import(
      /* webpackIgnore: true */
      "diagnostics_channel"
    ).catch(() => void 0);`;

const reactNativeSafeSnippet = `    diagnosticsChannelPromise = Promise.resolve(
      loadBuiltinModule("node:diagnostics_channel")
    ).catch(() => void 0);`;

for (const file of files) {
    if (!fs.existsSync(file)) {
        continue;
    }

    const original = fs.readFileSync(file, "utf8");

    if (original.includes(reactNativeSafeSnippet)) {
        continue;
    }

    if (!original.includes(dynamicImportSnippet)) {
        throw new Error(
            `AI SDK tracing patch target was not found in ${path.relative(
                process.cwd(),
                file
            )}`
        );
    }

    fs.writeFileSync(
        file,
        original.replace(dynamicImportSnippet, reactNativeSafeSnippet)
    );
}
