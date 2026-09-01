# kataria-syntex

Monorepo for Kataria Syntex — yarn trading + dyeing via job work.

## Workspaces

| Path                | What                                                                | Stack                                                                                                          |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/app`          | Internal business app — challans, job work, stock, packing, reports | React 19 + Vite + Tailwind v4 · Hono on Cloudflare Pages Functions · D1 (Drizzle) · PWA + Electron + Capacitor |
| `apps/web`          | Public showcase website                                             | Next.js + React 19 + Tailwind v4                                                                               |
| `packages/shared`   | Shared domain types, yarn/shade data, validation                    | TypeScript                                                                                                     |
| `packages/tsconfig` | Shared TS config presets                                            | —                                                                                                              |

## Commands

Bun is the only package manager.

```bash
bun install          # install all workspaces
bun run dev          # all dev servers
bun run build        # production build
bun run typecheck    # required gate
bun run lint         # required gate
bun run format:check # required gate
```

Inside `apps/app`:

```bash
bun run dev:server     # Hono API on :3000
bun run dev            # Vite frontend on :1420
bun run electron:dev   # Electron shell over the Vite dev server
bun run icons          # regenerate PWA/Electron icons from resources/icon.svg
bun run electron:package  # renderer + main + installer (electron-builder)
```

## Docs

- `AGENTS.md` — working agreement for AI agents and humans
- `dead-files/apps/app/SPEC.md` — archived single source of truth for the business app
- `dead-files/apps/app/BUILD.md` — archived build-order checklist
- `dead-files/FIXES.md` — archived known-bug backlog with file:line causes
- `dead-files/` — archived docs/code; reference only, never edit

## Platforms

- **Web/PWA + API** — Cloudflare free tier (Pages + Workers + D1, `wrangler pages dev`)
- **Desktop** — Electron (Windows x64, macOS arm64, Linux x64)
- **Android** — Capacitor universal APK, built in CI (`.github/workflows/app-build.yml`)
