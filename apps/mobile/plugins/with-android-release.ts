/**
 * Release signing + versioned APK name for the generated Android project.
 *
 * `expo prebuild` regenerates android/, so both live in a config plugin rather
 * than in the generated build.gradle:
 * - release signing reads keystore.properties (written by CI from the
 *   ANDROID_KEY_* secrets); without the file the release build stays unsigned,
 *   so local builds need no keystore.
 * - the release APK is named Kataria-Syntex-Biz-App-<version>.apk. Artifacts
 *   are served with a year-long immutable TTL, so an unversioned name could
 *   hand a cache a previous release's bytes for the wrong SHA-256.
 */
import type { ConfigPlugin } from "expo/config-plugins";
import { withAppBuildGradle } from "expo/config-plugins";

const MARKER = "// Kataria Syntex: release signing + versioned APK name";

const BLOCK = `
${MARKER} (plugins/with-android-release.ts)
def ksKeystorePropsFile = rootProject.file('keystore.properties')
def ksAppVersion = new groovy.json.JsonSlurper()
    .parseText(rootProject.file('../../app/package.json').text)
    .version

if (ksKeystorePropsFile.exists()) {
    def ksProps = new Properties()
    ksProps.load(new FileInputStream(ksKeystorePropsFile))
    android {
        signingConfigs {
            release {
                storeFile rootProject.file(ksProps['storeFile'])
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
}

androidComponents {
    onVariants(selector().withBuildType('release')) { variant ->
        variant.outputs.forEach { output ->
            output.outputFileName.set("Kataria-Syntex-Biz-App-\${ksAppVersion}.apk")
        }
    }
}
`;

const withAndroidRelease: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents += BLOCK;
    return cfg;
  });

export default withAndroidRelease;
