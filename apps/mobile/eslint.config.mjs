import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Native flat config — same shape as apps/app. typescript-eslint does not
// support TypeScript 7 yet, so type-aware linting stays off; type safety is
// enforced by `bun run typecheck`.
const eslintConfig = [
  {
    // Generated and build outputs are never linted.
    ignores: [
      "dist/",
      "android/",
      "ios/",
      ".expo/",
      "node_modules/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "expo-env.d.ts",
    ],
  },
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];

export default eslintConfig;
