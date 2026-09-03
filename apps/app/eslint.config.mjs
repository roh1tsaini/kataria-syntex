import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

// Native flat config. typescript-eslint does not support TypeScript 7 yet,
// so type-aware linting stays off — type safety is enforced by
// `bun run typecheck`.
const eslintConfig = [
  {
    // Build outputs and generated native projects are never linted — the
    // Capacitor android/ contains a copy of the bundled renderer (dist).
    ignores: [
      "dist/",
      "dist-electron/",
      "out/",
      "release/",
      "node_modules/",
      "android/",
      "build/",
      ".wrangler/",
      "tmp/",
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
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];

export default eslintConfig;
