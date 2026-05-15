// Flat ESLint config. Minimal Astro + TS surface: catch unused imports / vars,
// dead code, and stray `console.log` calls. Type-aware lint is intentionally
// disabled — `astro check` already gives us the TS diagnostics. Run via
// `npm run lint` and gated by `ci.yml`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".astro/**",
      ".vercel/**",
      "test/fixtures/**",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,astro}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unreachable": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Inline Astro <script> blocks: relax the no-explicit-any rule there —
    // hand-written DOM scripts often need a quick cast.
    files: ["**/*.astro/*.ts", "**/*.astro/*.js"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Build/generator scripts and tests legitimately log to stdout.
    files: ["scripts/**/*.mjs", "test/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
];
