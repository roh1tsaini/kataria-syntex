// No app source lives in apps/android — it is a Capacitor shell over the
// apps/app bundle, so linting is owned by apps/app. This config exists only
// so `bun run lint` does not fail on an empty workspace.
const eslintConfig = [
  {
    ignores: ["android/", "node_modules/", "dist/"],
  },
];

export default eslintConfig;
