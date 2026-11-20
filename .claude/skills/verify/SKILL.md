---
name: verify
description: Run the game's full verification and save evidence for a phase. Use before tagging a phase, after changing src/core, src/headless or src/render, or when asked to prove a requirement works.
---

1. `npm run typecheck` — must be clean.
2. `npm run verify -- phase-N` (N = current phase). It runs unit tests, runs every `tests/scenarios/*.case.json` twice and diffs the outputs (determinism), checks each case's `expect` block (`events` counts, `end`, `last` snapshot; partial match), and writes outputs + `verify-summary.txt` into `docs/proof/phase-N/`.
   - New feature → add `tests/scenarios/<name>.case.json` with `args` (use `--night 1|2|3`), optional `<name>.scenario.json` / `<name>.inputs.json`, and an `expect` block.
3. Visual / UI requirements (menus, 3-night flow, HUD, pause, settings, FPS): `npm run build && npm run smoke -- phase-N`. It writes `smoke.txt`, `fps.txt` (with machine config) and numbered screenshots to `docs/proof/phase-N/`. Add a check to `scripts/smoke.mjs` for any new UI requirement.
4. Performance / stability (Phase 4+): `npm run bench -- --seed 42 --duration 30 --out bench.json` and `npm run soak -- --seed 7 --nights 10 --out soak.json` (repo root; copy into `docs/proof/phase-N/`). Thresholds: avg_fps ≥ 60, p1_low_fps ≥ 30, load_ms ≤ 10000; crashes = 0, mem_end_mb ≤ 1.2 × mem_start_mb. Close other heavy apps first; numbers on your machine are only a reference.
5. Update the requirement → evidence table in `docs/proof/phase-N/README.md`: requirement, how verified, file, PASS / CHƯA ĐẠT + reason. Requirement ids come from `docs/spec/phase-N.md` or the ticket (`docs/lab/TICKET-0N.md`).
6. Never edit generated output by hand. If something fails, report it as failing.
