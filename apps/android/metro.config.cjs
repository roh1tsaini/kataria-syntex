const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const { withNativeWind } = require("nativewind/metro");

const here = __dirname;
const workspaceRoot = path.resolve(here, "../..");

const config = getDefaultConfig(here);

// Bun workspaces hoist packages to the repo root — Metro must watch the
// monorepo and resolve modules from both roots.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(here, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: "./global.css" });
