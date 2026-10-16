# kataria-syntex

Monorepo for Kataria Syntex — yarn trading + dyeing via job work.

Bun workspaces + Turborepo; Bun is the only package manager.

## Workspaces

| Path                | What                                                                                                              | Stack                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/app`          | Internal business app — web + Electron desktop                                                                    | React 19 + Vite + Tailwind v4 + Zustand · Hono on Cloudflare Workers · D1 (Drizzle) · Web + Electron      |
| `apps/android`      | Internal business app — Android shell around the `apps/app` bundle                                                | Capacitor 8 · renders the `apps/app` React 19/Vite bundle, which is where `packages/app-core` is consumed |
| `apps/web`          | Public showcase website                                                                                           | Next.js + React 19 + Tailwind v4 · Vinext on Cloudflare Workers                                           |
| `packages/shared`   | Shared domain types, yarn/shade data, validation (`@kataria-syntex/shared`)                                       | TypeScript                                                                                                |
| `packages/app-core` | Shared business core for both apps: API client, zustand stores, network reachability (`@kataria-syntex/app-core`) | TypeScript + React                                                                                        |
| `packages/tsconfig` | Shared TS config presets                                                                                          | —                                                                                                         |

The Android shell renders the same built `apps/app` bundle — one product,
three shells, no separate Android UI (`AGENTS.md` Section 2.3). Its native project
and per-platform behaviour are documented in `apps/app/spec.md` (Section 5.1, Section 5.2).

Install, build, dev servers and the required gates: `AGENTS.md` Section 3.

## Docs

- `AGENTS.md` — working agreement + doc rules: parity, gates, commands
- `DEPLOY.md` — deploy & maintenance on GitHub + Cloudflare
- `apps/app/spec.md` — business app: screens, fields, data, and tech reference (incl. the Android shell)
- `apps/app/rules.md` — business app logic, calculations, numbering
- `apps/app/design.md` — app design system
