# Decisions pending — owner call

Each item needs a decision before code changes. Nothing here is breaking today.

## 1. Native builds on every push to main

`.github/workflows/app-build.yml` runs all 3 desktop builds + the APK job on
every push to `main` that touches `apps/app/**`. DEPLOY.md documents this.
If they should run on manual dispatch only, add an `if` to the `desktop` and
`android` jobs.
