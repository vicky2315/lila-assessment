# Progress Log

> Running log. Work is driven by the task list in [REQUIREMENTS.md](REQUIREMENTS.md) §6. Pick the next unchecked task there, do it, tick it there, log it here. REQUIREMENTS wins on any conflict.

## Current status

**Phase:** Day 3, polish + docs
**Next up:** Day 3 (insights using the tool, README, ARCHITECTURE.md, INSIGHTS.md, walkthrough).
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
- Validated: 87,599 rows after dedupe (dedupe later removed, see 09-30 night entry); event totals match heat totals; README example point = px (78, 890); overlays on all 3 maps sit on roads and avoid rocks and water.
- Note: 1,253 of the 1,505 dropped duplicates were Loot rows (same player, second and position). Treated as double logging at the time. Reversed 09-30: all rows kept.
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

### 2026-09-30 (Wed, night): user decisions on AUDIT §3.2
- A: keep every row. Removed dedupe from `preprocess.py`, rebuilt data (89,104 rows). `verify_data.py` now also asserts rows in = rows out: PASS.
- B: raw event names. Tooltips, timeline ticks and legend titles show the raw name; bot-file events read e.g. "BotKilled (in bot's file)". User note: may mean a bot killed by another bot. Unconfirmed, not shown as fact.
- C: smooth playback kept.
- Docs updated: DATA_PIPELINE §2.3, §2.4, §3; REQUIREMENTS §4; AUDIT §2, §3.2.
- Deployed (commit de2b7e1). Live checks: UI audit 25/25 PASS on https://vicky2315.github.io/lila-assessment/ ; live Loot total 12,885 = raw count, so duplicates are kept on the live site too.

### End of session 2026-09-30 (work laptop): handoff
- **State:** R1 to R8 done and verified (AUDIT.md). Working tree clean, everything pushed.
- **Next (Day 3, personal laptop):** find 3 insights using the tool, then README (with live URL, stack, setup, "no env vars"), ARCHITECTURE.md (one page), INSIGHTS.md, walkthrough. Task list: REQUIREMENTS §6.
- **Personal laptop setup:** install Git + Node 24, `git clone https://github.com/vicky2315/lila-assessment.git`, `npm install`, `npm run dev`, set repo-local `git config user.email vigneshvinith23157@gmail.com` and `user.name Vignesh`.
- **Only if re-running pipeline or audits:** Python 3.10+, raw `player_data/` next to the repo folder, `pip install -r scripts/requirements.txt`. UI audit also needs `npm i --no-save puppeteer-core` and a Chrome path argument if Chrome is not at the Windows default.

### 2026-10-02 (Fri, personal laptop)
- Setup: laptop had Node 20.17. Vite 8 needs 20.19+, so npm skipped the Windows bundler binding and the build failed. Installed Node 24 (per `.nvmrc`), reinstalled: build OK. npm 11 rewrote 4 `"peer"` lines in `package-lock.json`; reverted, no version changes.
- Fix: GrandRift minimap has red and orange zones painted on (Mine Pit, quarters), so heat colours blended in. While a heatmap is on, the minimap is now drawn grey at 70% brightness (`MapView.tsx`, built once per image, not per frame). All maps, for consistency. Logged in AUDIT §3.1 #10.
- UI audit re-run (Edge, Chrome not installed here): 25/25 PASS. Screenshots of GrandRift traffic and kills checked.
- Noted, not changed: GrandRift kills heat is faint. Kill events are sparse there; unrelated to this fix.
- User asked for a way to make faint heat stronger. Added an "Intensity" slider (1× to 5×) under Opacity. First try multiplied cell counts before colouring: no help, because sparse cells were already at the top colour and the blur thins them out. Final version multiplies alpha after the blur. GrandRift kills now readable at 3×. UI audit 25/25 PASS. Logged in AUDIT §3.1 #11.
- Checked "743 matches with 1 human": correct. 743 have one file only (1 human, no bot files), 36 have 1 human + bot files, 16 have bot files only, 1 has 2 humans. Index and match files agree.
- Insights: computed candidates per map (death causes, storm timing, hot spots, loot per minute). User picked 3: (1) data looks like test matches (93% one recorded player, 90% of human deaths by bots, 3 human kills total), (2) Mine Pit and the Ambrose river as fight zones (Mine Pit 17% of movement, 47% of deaths; river 17% of movement, 28% of deaths), (3) players who die loot 40% to 60% slower per minute. Zone checks used outlines traced from the minimaps. Wrote `INSIGHTS.md` with two screenshots from the live tool in `docs/img/`.
- Note: the tool's Deaths layer counts events in bot files too (505 on Ambrose Valley). INSIGHTS uses human deaths only and says so.
- Added `scripts/insights/charts.py`: recomputes every INSIGHTS number from `public/data` and writes one SVG chart per insight to `docs/img/` (light and dark aware, palette checked for colour-blind safety). Charts embedded in INSIGHTS.md.
- Commit rule: no AI attribution lines from now on (added to CLAUDE.md). Removing the old lines from history needs a force-push; postponed by user.
- README: added a step-by-step "How to use it" guide for level designers, using the exact labels in the UI.
- Final audit before submission (AUDIT.md, last section): data consistent and unchanged since the raw check, live UI 25/25, no broken links. Brief re-read line by line; open items listed for the user.
- Fixes after final audit: env vars section back in README, "battle royale" -> "extraction shooter" (brief's wording), two grammar fixes in INSIGHTS. D3, D4, D5 ticked. Only the walkthrough (D6) is left.
- Added a Reset view link next to the Map heading: clears the URL state, legend toggles, sliders, speed, match search and sort, and fits the map. Reason: a shared or autocompleted link opens the last view, user wanted a one-click way back. UI audit has 2 new checks for it: 27/27 PASS.
- Added a heatmap colour key (Fewer to More bar, same colours as the heatmap) and a line saying who is counted (humans and bots; per match it follows the legend toggles). Reason: user read red/yellow as human/bot. UI audit 27/27 PASS.
- Fixed walkthrough shot list: first suggested match (de5aa1ae) has 0 humans. Replaced with d3a3297e (1 human, 13 bots).
