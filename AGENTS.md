# AGENTS.md — Đảo Đèn Lồng

3D third-person game (Three.js) + headless simulator following `game.contract.json` (Test Contract v1.0).

## Commands
- `npm ci` — install
- `npm run dev` — play in browser (Vite)
- `npm test` — unit tests (Vitest)
- `npm run typecheck`
- `npm run headless -- --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json]`
- `npm run verify -- phase-N` — unit tests + every `tests/scenarios/*.case.json` run twice (determinism) + saves proof to `docs/proof/phase-N/`
- `npm run build` — static build to `dist/`

## Layout
- `src/core/` pure deterministic sim (60 ticks/s). `src/headless/` CLI. `src/render/` Three.js, HUD, VFX, audio.
- `tests/` unit tests; `tests/scenarios/` headless cases. `docs/notes/` assumptions, changes, ai-log, retro. `docs/proof/` evidence.
- Lab requirements: `docs/lab/`, phase docs on the lab board. Plan: `KE_HOACH.md`.

## Hard rules
- `src/core` must NOT import from `src/render`, use `Math.random()`, `Date.now()`, or any wall clock. Use `makeRng(seed)`.
- Tuning numbers live ONLY in `src/core/tuning.ts`; `game.contract.json` must match (a test checks it).
- Extras/creative features are render-only and must not change headless output.
- Never hand-edit proof output, never write tests that always pass, never mark an unmet requirement as met.
- Quote the contract text when unsure; do not invent requirements. Write assumptions to `docs/notes/assumptions.md`.
- Assets: only CC0 / CC-BY / MIT or self-made; add a line to `CREDITS.md` when adding one. Nothing from Sky or other games.
- Small commits, one change each. Run `npm test` before saying done.
