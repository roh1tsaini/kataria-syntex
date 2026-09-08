import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Native flat config for the React Native app. typescript-eslint does not
// support TypeScript 7 yet, so type-aware linting stays off — type safety
// is enforced by `bun run typecheck`. jsx-a11y is web-only (RN has native
// accessibility props, used across the screens).
const eslintConfig = [
  {
    // Build outputs are never linted (android/ is prebuild-generated).
    ignores: ["android/", ".expo/", ".expo-export/", "node_modules/", "dist/"],
  },
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
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
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];

export default eslintConfig;
