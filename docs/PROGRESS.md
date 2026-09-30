# Progress Log

> Running log. Work is driven by the task list in [REQUIREMENTS.md](REQUIREMENTS.md) §6. Pick the next unchecked task there, do it, tick it there, log it here. REQUIREMENTS wins on any conflict.

## Current status

**Phase:** Day 1, pipeline + scaffold
**Next up:** user decisions on AUDIT §3.2 (A dedupe, B bot tooltip wording, C smooth playback), then Day 3 (insights, README, ARCHITECTURE, INSIGHTS, walkthrough).
**Blockers:** none. Repo created: https://github.com/vicky2315/lila-assessment

## Log

### 2026-09-30 (Wed)
- Read brief. Probed raw data (1,243 parquet files [first probe said 1,242 by grouping on file name; corrected in audit 09-30], 89,104 rows, 796 matches, 0 unreadable files).
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
- Git init with repo-local personal identity (vigneshvinith23157@gmail.com). Added `.gitattributes` (LF everywhere) so both laptops store files the same way. First push to `main`: commit 3a39ac0, 815 files.
- Scaffolded Vite 8 + React 19 + TypeScript app (skeleton: loads index.json, shows selected minimap). Local build and preview OK under `/lila-assessment/`.
- Added `.github/workflows/deploy.yml`: builds on push to `main`, publishes `dist/` to Pages. Pushed (commit e825eb9).
- First Pages deploy failed: build job passed, deploy job got 404 "Ensure GitHub Pages has been enabled". Pages API also returns 404, so Pages is not enabled on the repo yet. Waiting on user to re-check Settings > Pages.
- Pages re-checked by user. Second deploy succeeded (commit b172664). Live: https://vicky2315.github.io/lila-assessment/ . Page, JS, index.json, minimaps and heat files all return 200.
- Non-blocking: GitHub warns actions v4 run on Node 20 (deprecated, forced to Node 24). Works today. Revisit only if it breaks.
- Wrote `docs/DATA_PIPELINE.md` (learning guide: raw format, each data quirk as an investigation, pipeline step by step, coordinate maths, exercises). Moved exploration scripts into `scripts/explore/` with repo-relative paths.

### 2026-09-30 (Wed, evening): Day 2 tasks started early
- Built the explorer UI: `MapView` (canvas, pan/zoom, paths, markers, hover tooltip), `Sidebar` (map, days, heatmap, match list), `Legend` (doubles as toggles), `Timeline` (play/pause, speed, scrubber, event ticks), `useHashState` (shareable URL).
- Chrome extension not connected, so tested with headless Chrome screenshots. Overview, match view, per-match heat and all-match heat render correctly.
- Fixes from the screenshots: heatmap contrast (normalise to 98th percentile instead of max), match date from the timestamp instead of the folder, "1 human" instead of "1H · 0B", tooltip wording for events in bot files.
- User asked for per-match heatmaps. Added "This match / All matches" scope. Per-match heat builds up with playback.
- Decisions logged in REQUIREMENTS §4 and §5.

### 2026-09-30 (Wed, night): full audit
- User rules added (REQUIREMENTS §0.0): present data as is, no new or derived data; small screens not a priority.
- Ran full audit, written up in `docs/AUDIT.md`. Scripts in `scripts/audit/`.
- Data re-derived from raw by an independent script: PASS. Two audit-script bugs on the way (timezone, sort-before-round), both documented as lessons.
- File count corrected: 1,243 (not 1,242). One file name repeats across Feb 10 and Feb 11.
- Scripted browser test: 25/25 PASS after fixes.
- Code review: 8 issues fixed (empty day selection, bad-link crash, space bar, cross-map flash, silent heat error, canvas realloc, stale tooltip, hardcoded partial day).
- Repo, privacy and deployment clean. 804/804 live files return 200.
- 3 interpretations listed for user decision (AUDIT §3.2).
