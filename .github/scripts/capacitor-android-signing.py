#!/usr/bin/env python3
"""Writes android/keystore.properties from the ANDROID_KEY_* GitHub secrets so
the Capacitor release build signs the APK.

Usage:
  KEYSTORE_FILE=/path/keystore.p12 \
  KEYSTORE_ALIAS=alias \
  KEYSTORE_PASSWORD=password \
  python3 .github/scripts/capacitor-android-signing.py apps/app/android

Fails fast if a secret is missing (never silently produce an unsigned release).
"""
import os
import sys


def main() -> None:
    android_dir = sys.argv[1] if len(sys.argv) > 1 else "apps/app/android"
    key_file = os.environ.get("KEYSTORE_FILE")
    key_alias = os.environ.get("KEYSTORE_ALIAS")
    key_password = os.environ.get("KEYSTORE_PASSWORD")

    missing = [n for n, v in [("KEYSTORE_FILE", key_file), ("KEYSTORE_ALIAS", key_alias), ("KEYSTORE_PASSWORD", key_password)] if not v]
    if missing:
        print(f"::error::Android signing secrets missing: {', '.join(missing)}. Set ANDROID_KEY_BASE64, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD in the repository secrets.", file=sys.stderr)
        sys.exit(1)

    store_path = os.path.abspath(key_file)
    props = (
        f"storeFile={store_path}\n"
        f"storePassword={key_password}\n"
        f"keyAlias={key_alias}\n"
        f"keyPassword={key_password}\n"
    )
    with open(os.path.join(android_dir, "keystore.properties"), "w") as f:
        f.write(props)
    print(f"keystore.properties written ({store_path})")


if __name__ == "__main__":
    main()
