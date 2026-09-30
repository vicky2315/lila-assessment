# Progress Log

> Running log. Work is driven by the task list in [REQUIREMENTS.md](REQUIREMENTS.md) §6. Pick the next unchecked task there, do it, tick it there, log it here. REQUIREMENTS wins on any conflict.

## Current status

**Phase:** Day 1, pipeline + scaffold
**Next up:** git init + push, scaffold app, Pages deploy
**Blockers:** none. Repo created: https://github.com/vicky2315/lila-assessment

## Log

### 2026-09-30 (Wed)
- Read brief. Probed raw data (1,242 parquet files, 89,104 rows, 796 matches, 0 unreadable files).
- Found data quirks → recorded in REQUIREMENTS §4 (ts = unix seconds, real minimap sizes, bot-ID anomaly, dupes).
- Locked decisions: React + TS, GH Pages repo `lila-assessment`, processed data only.
- Wrote `scripts/preprocess.py` + `scripts/requirements.txt` (not run yet).
- Wrote REQUIREMENTS.md; re-verified against brief → added grading criteria, principles, brief's checklist, ARCHITECTURE/INSIGHTS sub-items, "insights must come from tool", single-repo submission rule.
- Repo name changed by user: `vicky2315/lila-assessment`. Updated URL and base path in REQUIREMENTS.
- Ran preprocessing (9s). Output: 796 match files, 3 heat files, index, 3 webp minimaps. Total ~4.7 MB (data 4.1 MB, minimaps 0.55 MB, down from 24 MB).
- Validated: 87,599 rows after dedupe; event totals match heat totals; README example point = px (78, 890); overlays on all 3 maps sit on roads and avoid rocks and water.
- Note: 1,253 of the 1,505 dropped duplicates were Loot rows (same player, second and position). Treated as double logging. Goes in ARCHITECTURE assumptions.
- User works on personal laptop from Thu. Added `.gitignore`, `.nvmrc`, `CLAUDE.md`, two-laptop rules (REQUIREMENTS §1.1).
- Found: global git identity on work laptop is the work email. Must set personal identity per repo before first commit.
