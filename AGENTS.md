# AGENTS.md — Đảo Đèn Lồng

3D third-person game (Three.js) + headless simulator following `game.contract.json` (Test Contract **v1.1**, Ticket-02).
3 nights (Đảo Bến, Đảo Cau, Đảo Chuông), dash, falls, jump pads, wind, Gió Lạc (drifters), Bùa Gió (charms), pause.

## Commands
- `npm ci` — install
- `npm run dev` — play in browser (Vite)
- `npm test` — unit tests (Vitest)
- `npm run typecheck`
- `npm run headless -- --seed 1 --night 1|2|3 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json]`
- `npm run verify -- phase-N` — unit tests + every `tests/scenarios/*.case.json` run twice (determinism) + its `expect` block checked + proof to `docs/proof/phase-N/`
- `npm run build && npm run smoke -- phase-N` — browser check (menus, 3 nights, HUD, pause, settings, FPS) + screenshots
- `npm run build` — static build to `dist/`

## Layout
- `src/core/` pure deterministic sim (60 ticks/s): `sim.ts` (step), `maps.ts` (3 standard maps + `ground()`), `tuning.ts`, `rng.ts`.
- `src/headless/` CLI + parser (trust boundary). `src/render/` Three.js, HUD/menus (`main.ts`, `index.html`), `palette.ts`, prefabs, audio.
- `tests/` unit tests; `tests/scenarios/` headless cases. `docs/spec/` acceptance criteria. `docs/notes/` assumptions, changes, ai-log. `docs/proof/` evidence.
- Requirements: `docs/lab/` (Ticket-02 text in `docs/lab/TICKET-02.md`). Plan: `KE_HOACH.md`.

## Hard rules
- `src/core` must NOT import from `src/render`, use `Math.random()`, `Date.now()`, or any wall clock. Use `makeRng(seed)`.
- Contract numbers live ONLY in `TUNING` (`src/core/tuning.ts`), other standard numbers in `RULES`; `game.contract.json` must equal `TUNING` (a test checks it). Map data only in `maps.ts`.
- `step()` keeps the Ticket-02 tick order (pause → timers → move May → pickup → lanterns → safe zone → pulse → move enemies → touch → spawns → win/lose). Do not reorder.
- Shade states are exactly `spawning, wander, chase, recoil, stunned`. Ticket colors come only from `src/render/palette.ts`.
- Extras/creative features are render-only and must not change headless output.
- Never hand-edit proof output, never write tests that always pass, never mark an unmet requirement as met.
- Every new rule gets a unit test AND a scenario with an `expect` block (events / end / last snapshot). Expected values come from reasoning about the rule, not from copying output.
- Quote the ticket/contract when unsure; do not invent requirements. Write assumptions to `docs/notes/assumptions.md` (section B for Phase 2).
- Assets: only CC0 / CC-BY / MIT or self-made; add a line to `CREDITS.md` when adding one. Nothing from Sky or other games.
- Small commits, one change each. Run `npm test` before saying done.
