# BUILD — order of work

> One line per feature. `- [ ]` → `- [x]` only when implemented AND verified
> (typecheck + build green + works when run). Never redo ticked items.

## Phase 0 — foundation

- [x] New app skeleton (Vite + React SPA, Hono/Bun server, SQLite/Drizzle)
- [x] Login — full auth system: QR login (any-camera URL approve), phone/email
      identifier with OTP or password, auto-join for pre-added members,
      admin-scan QR fallback when OTP quota is out (verified live 2026-08-25)
- [ ] Denier master (list/add deniers — every module depends on it)
- [ ] App shell: navigation between modules

## Phase 1 — core flow

- [ ] Raw material purchase entry (SPEC §1)
- [ ] Job work outward challan (SPEC §2)
- [ ] Job work return (spec pending)
- [ ] Packing (spec pending)
- [ ] Sales challan (spec pending)

## Phase 2 — visibility

- [ ] Stock view (spec pending)
- [ ] Reports (spec pending)

## Phase 3 — access & platform

- [ ] Members / roles / login (spec pending)
- [ ] Settings (spec pending)
- [ ] Android (Capacitor) / desktop (Electron) / PWA — all three shells
