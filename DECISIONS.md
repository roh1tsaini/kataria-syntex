# Decisions pending — owner call

Each item needs a decision before code changes. Nothing here is breaking today.

## 1. Native builds on every push to main

Status: push builds are currently ON — `.github/workflows/app-build.yml`
runs all 3 desktop builds + the APK job on every push to `main` that
touches `apps/app/**`. DEPLOY.md documents this.
Open question: keep push builds, or switch to manual dispatch only? If the
latter, add an `if` to the `desktop` and `android` jobs.
