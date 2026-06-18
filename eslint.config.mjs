import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Generated, deployment, report, and archival artifacts are outside main quality gates.
    "public/maplibre-gl-csp-worker.js",
    "_scripts/recovery_tools/**",
    ".firebase/**",
    "playwright-report/**",
    "test-results/**",
    "_docs/**",
    "Codex/**",
    "web/**",
  ]),
]);

export default eslintConfig;
