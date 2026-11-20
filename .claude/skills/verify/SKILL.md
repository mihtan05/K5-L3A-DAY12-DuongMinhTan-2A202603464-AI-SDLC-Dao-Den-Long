---
name: verify
description: Run the game's full verification and save evidence for a phase. Use before tagging a phase, after changing src/core or src/headless, or when asked to prove a requirement works.
---

1. `npm run typecheck` — must be clean.
2. `npm run verify -- phase-N` (N = current phase). It runs unit tests, runs every `tests/scenarios/*.case.json` twice and diffs the outputs (determinism), and writes outputs + `verify-summary.txt` into `docs/proof/phase-N/`.
3. If a requirement needs a visual check (HUD, win/lose screen, VFX): `npm run dev`, then use the Playwright MCP to open http://localhost:5173, play the needed keys, and save screenshots into `docs/proof/phase-N/` with a name saying which requirement it proves.
4. Update the requirement → evidence table in `docs/proof/phase-N/README.md`: requirement, how verified, file, PASS / CHƯA ĐẠT + reason.
5. Never edit generated output by hand. If something fails, report it as failing.
