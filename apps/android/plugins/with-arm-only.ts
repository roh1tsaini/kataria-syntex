/**
 * ARM-only native builds. The universal APK used to bundle x86/x86_64
 * libs (emulators only — no real phone ships those), roughly doubling
 * CMake + strip + dex work until CI's cold runner timed out near 90 min.
 * This pins the architectures React Native compiles so `assembleRelease`
 * ships arm64-v8a + armeabi-v7a only.
 */

import type { ConfigPlugin } from "@expo/config-plugins";
import { withGradleProperties } from "@expo/config-plugins";

const ARCH_KEY = "reactNativeArchitectures";
const ARM_ARCHES = "armeabi-v7a,arm64-v8a";

const plugin: ConfigPlugin = (config) => {
  return withGradleProperties(config, (mod) => {
    mod.modResults = [
      ...mod.modResults.filter(
        (item) => !(item.type === "property" && item.key === ARCH_KEY),
      ),
      { type: "property" as const, key: ARCH_KEY, value: ARM_ARCHES },
    ];
    return mod;
  });
};

export default plugin;
