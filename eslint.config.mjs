import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Legacy code has many `any` types; keep them visible as warnings and
      // tighten back to "error" once they are paid down.
      "@typescript-eslint/no-explicit-any": "warn",
      // New in eslint-plugin-react-hooks 7.1 (React Compiler rules). They flag 34 long-standing
      // patterns — fetch-then-setState inside an effect, and mutating a value after it is captured.
      // Visible as warnings while they are paid down page by page; raise back to "error" after that.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "scripts/archived/**",
  ]),
]);

export default eslintConfig;
