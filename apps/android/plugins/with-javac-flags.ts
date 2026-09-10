/**
 * Silences upstream javac "removal" deprecation noise on the RN 0.87
 * toolchain: @react-native-community/netinfo 12.0.1 (latest) overrides
 * NativeModule#onCatalystInstanceDestroy, which RN marked for removal —
 * every build floods CI logs with [removal] warnings we cannot fix
 * upstream. Compilation is unaffected; this only keeps logs readable.
 */

import type { ConfigPlugin } from "@expo/config-plugins";
import { withProjectBuildGradle } from "@expo/config-plugins";

const MARKER = "// javac: silence upstream deprecation-removal noise";

const SILENCER = `
${MARKER}
subprojects {
    tasks.withType(JavaCompile).configureEach {
        options.compilerArgs += ["-Xlint:-removal"]
    }
}
`;

const plugin: ConfigPlugin = (config) => {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) return mod;
    mod.modResults.contents += SILENCER;
    return mod;
  });
};

export default plugin;
