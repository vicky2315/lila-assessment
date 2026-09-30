# Project rules

- `docs/REQUIREMENTS.md` is the single source of truth: scope, decisions, data rules, task list. Pick the next unchecked task there, do it, tick it there.
- `docs/PROGRESS.md` is the running log. Add an entry after each piece of work.
- Writing style (replies and all docs): simple English, short and precise. No em dashes.
- Explain each step to the user before running it: what it does and why.
- Work moves between two laptops. Keep everything needed in this repo. No absolute paths, no machine-specific setup. Raw `player_data/` is never committed.
- `docs/DATA_PIPELINE.md` explains how the raw data was parsed and why. Read it before changing `scripts/preprocess.py`.
