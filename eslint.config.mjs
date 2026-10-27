import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const entryMessage =
  "Import a server module through its entry: @/server/<module> or @/server/platform/<area>.";

// no-restricted-imports entries replace each other for overlapping files, so every
// entry below repeats these entry-only patterns.
const entryOnlyPatterns = [
  { group: ["@/server/*/*", "!@/server/platform/*"], message: entryMessage },
  { group: ["@/server/platform/*/*"], message: entryMessage },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent tooling, not app code.
    ".agents/**",
    ".claude/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: entryOnlyPatterns }],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/shared/providers/QueryProvider.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@tanstack/react-query", message: "Use a hook from @/lib/<domain>/hooks." }],
          patterns: entryOnlyPatterns,
        },
      ],
    },
  },
  {
    files: ["src/server/**/*.rules.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "mongodb",
            "next",
            "@/server/platform/database",
            "@/server/platform/http",
            "@/server/platform/events",
            "@/server/platform/auth",
            "@/server/platform/env",
          ],
          patterns: [
            ...entryOnlyPatterns,
            { group: ["next/*", "**/*.repository"], message: "Rules are pure: no I/O, framework or repository imports." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/**"],
    ignores: [
      "src/server/platform/**",
      "**/*.repository.ts",
      "**/__tests__/**",
      "**/*.rules.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/platform/database",
              importNames: ["getCollection", "getDb"],
              message: "Raw collection access belongs in a *.repository.ts file.",
            },
          ],
          patterns: entryOnlyPatterns,
        },
      ],
    },
  },
]);

export default eslintConfig;
