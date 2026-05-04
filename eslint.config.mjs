import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "deep-review-*.md",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Renderer (browser, React, JSX)
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      // react-hooks v7 added several strict rules that flag patterns this
      // codebase uses intentionally:
      // - set-state-in-effect: sync state with prop/external system is legit
      // - refs: assigning ref.current = latestValue during render is the
      //   documented pattern for keeping a stable identity around an
      //   ever-changing closure (e.g. navigate, onChange)
      // - static-components: motion's getMotionComponent helper requires
      //   per-render component creation; refactoring it is out of scope
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
    },
  },

  // Main process + scripts (Node)
  {
    files: ["src/main/**/*.ts", "scripts/**/*.{js,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },

  // CommonJS scripts — the project has no "type": "module" so plain .js
  // scripts use require() by design.
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Project-wide rule tweaks
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Must come last so its rule-disables aren't clobbered
  prettierConfig,
);
