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

| Path                | What                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `apps/app`          | Internal business app (web/PWA + Electron + the Android shell bundle) |
| `apps/android`      | Android Capacitor shell over the `apps/app` bundle                    |
| `apps/web`          | Public showcase website                                               |
| `packages/app-core` | Shared business core (API client, stores, offline engine)             |
| `packages/shared`   | Shared domain types, yarn/shade data, validation                      |
| `packages/tsconfig` | Shared TS config presets                                              |

Per-workspace commands (dev servers, Electron, Android APK) live in
`AGENTS.md` §3.

## Docs

- `AGENTS.md` — working agreement: repo map, parity rules, gates
- `DEPLOY.md` — deploy & maintenance on GitHub + Cloudflare
- `apps/app/APP.md` — business app reference
- `apps/android/APP.md` — Android shell reference
- `apps/app/design.md` — app design system
- `apps/web/design.md` — website design system
