# kataria-syntex

Monorepo for Kataria Syntex — yarn trading + dyeing via job work.

Bun workspaces + Turborepo; Bun is the only package manager.

## Workspaces

| Path                | What                                                                                                              | Stack                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/app`          | Internal business app — web + Electron desktop                                                                    | React 19 + Vite + Tailwind v4 + Zustand · Hono on Cloudflare Workers · D1 (Drizzle) · Web + Electron |
| `apps/mobile`       | Internal business app — Android phone app                                                                         | Expo SDK 57 (React Native) · TypeScript · Expo Router · NativeWind 4 · `@kataria-syntex/app-core`    |
| `apps/web`          | Public showcase website                                                                                           | Next.js + React 19 + Tailwind v4 · Vinext on Cloudflare Workers                                      |
| `packages/shared`   | Shared domain types, yarn/shade data, validation (`@kataria-syntex/shared`)                                       | TypeScript                                                                                           |
| `packages/app-core` | Shared business core for both apps: API client, zustand stores, network reachability (`@kataria-syntex/app-core`) | TypeScript + React                                                                                   |
| `packages/tsconfig` | Shared TS config presets                                                                                          | —                                                                                                    |

The Android phone app is built with Expo (React Native), TypeScript, Expo Router, and NativeWind, consuming the shared `@kataria-syntex/app-core` business logic with native keystore and network seams.

Install, build, dev servers and the required gates: `AGENTS.md` Section 3.

## Docs

- `AGENTS.md` — working agreement + doc rules: parity, gates, commands
- `DEPLOY.md` — deploy & maintenance on GitHub + Cloudflare
- `apps/mobile/APP.md` — mobile app architecture, testing, and release guide
- `apps/app/spec.md` — business app: screens, fields, data, and tech reference
- `apps/app/rules.md` — business app logic, calculations, numbering
- `apps/app/design.md` — app design system
