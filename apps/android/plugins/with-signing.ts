/**
 * Release signing for the prebuild-generated android project. CI decodes
 * ANDROID_KEY_BASE64 into android/keystore.properties before running
 * gradlew; this plugin wires that file into the release buildType so
 * `assembleRelease` produces a signed APK. Local debug builds (no
 * keystore.properties present) keep Expo's default debug signing.
 */

import type { ConfigPlugin } from "@expo/config-plugins";
import { withAppBuildGradle } from "@expo/config-plugins";

const DEFS_MARKER = "defaultConfig {";
const BUILD_TYPES_MARKER = "buildTypes {";
const RELEASE_SIGNING_MARKER = "signingConfig signingConfigs.debug";

const plugin: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (mod) => {
    let src = mod.modResults.contents;

    if (
      !src.includes(DEFS_MARKER) ||
      !src.includes(BUILD_TYPES_MARKER) ||
      !src.includes(RELEASE_SIGNING_MARKER)
    ) {
      throw new Error(
        "with-signing: app/build.gradle template changed — signing markers not found. " +
          "Update plugins/with-signing.ts to match the new template.",
      );
    }

    // Keystore properties loader, right before defaultConfig.
    src = src.replace(
      DEFS_MARKER,
      `// Release signing — CI writes android/keystore.properties from the
// ANDROID_KEY_* secrets (see .github/workflows/pipeline.yml).
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

${DEFS_MARKER}`,
    );

    // Point the release buildType at the release signing config when the
    // keystore is present (fall back to debug signing otherwise). The
    // template also has a debug signing marker, so scope the replacement to
    // the release block instead of replacing the first occurrence globally.
    const buildTypesAt = src.indexOf(BUILD_TYPES_MARKER);
    const releaseAt = src.indexOf("release {", buildTypesAt);
    const releaseSigningAt = src.indexOf(RELEASE_SIGNING_MARKER, releaseAt);
    if (releaseAt < 0 || releaseSigningAt < 0) {
      throw new Error(
        "with-signing: release signing marker is not inside buildTypes.release.",
      );
    }
    src =
      src.slice(0, releaseSigningAt) +
      `if (keystorePropertiesFile.exists()) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }` +
      src.slice(releaseSigningAt + RELEASE_SIGNING_MARKER.length);

    // Declare the release signing config after the existing debug one.
    src = src.replace(
      /signingConfigs \{/,
      `signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`,
    );

    mod.modResults.contents = src;
    return mod;
  });
};

export default plugin;
