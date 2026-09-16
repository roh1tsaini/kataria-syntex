# kataria-syntex

Monorepo for Kataria Syntex — yarn trading + dyeing via job work.

Bun workspaces + Turborepo; Bun is the only package manager.

```bash
bun install
bun run dev        # all dev servers
bun run build      # production build
bun run typecheck  # required gate
bun run lint       # required gate
```

## Workspaces

| Path                | What                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `apps/app`          | Internal business app (web + Electron + the Android shell bundle) |
| `apps/android`      | Android Capacitor shell over the `apps/app` bundle                |
| `apps/web`          | Public showcase website                                           |
| `packages/app-core` | Shared business core (API client, stores, offline engine)         |
| `packages/shared`   | Shared domain types, yarn/shade data, validation                  |
| `packages/tsconfig` | Shared TS config presets                                          |

The Android shell renders the same built `apps/app` bundle — one product,
three shells, no separate Android UI (`AGENTS.md` Section 2.3). Its native project
and per-platform behaviour are documented in `apps/app/APP.md` (Section 5.1, Section 5.2).

Per-workspace commands (dev servers, Electron, Android APK) live in
`AGENTS.md` Section 3.

## Docs

- `AGENTS.md` — working agreement: repo map, parity rules, gates
- `DEPLOY.md` — deploy & maintenance on GitHub + Cloudflare
- `apps/app/APP.md` — business app reference (incl. the Android shell)
- `apps/app/design.md` — app design system
- `apps/web/APP.md` — website reference
- `apps/web/design.md` — website design system
