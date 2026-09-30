# Project rules

- `docs/REQUIREMENTS.md` is the single source of truth: scope, decisions, data rules, task list. Pick the next unchecked task there, do it, tick it there.
- `docs/PROGRESS.md` is the running log. Add an entry after each piece of work.
- Writing style (replies and all docs): simple English, short and precise. No em dashes.
- Present data as is. No new or derived datasets, no features that need data we do not have. Small-screen layout is not a priority. (REQUIREMENTS §0.0)
- Explain each step to the user before running it: what it does and why.
- Work moves between two laptops. Keep everything needed in this repo. No absolute paths, no machine-specific setup. Raw `player_data/` is never committed.
- `docs/DATA_PIPELINE.md` explains how the raw data was parsed and why. Read it before changing `scripts/preprocess.py`.
- `docs/AUDIT.md` records the full audit. Re-run `scripts/audit/verify_data.py` after any pipeline change and `scripts/audit/ui_check.mjs` after any UI change.
