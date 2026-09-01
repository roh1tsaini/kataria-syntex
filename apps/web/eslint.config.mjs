import next from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

// Native flat config (no eslint-config-next compat layer). Two ecosystem
// lags keep this config minimal:
// - typescript-eslint does not support TypeScript 7 yet — type safety is
//   enforced by `bun run typecheck` instead of type-aware lint rules.
// - eslint-plugin-react calls the removed context.getFilename(), so ESLint
//   is pinned to ~9.38.0 until the plugin catches up.
const eslintConfig = [
  {
    ignores: [".next/", "node_modules/", "next-env.d.ts"],
  },
  {
    plugins: {
      "@next/next": next,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default eslintConfig;
