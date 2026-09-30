# Requirements: LILA Player Journey Visualization Tool

> **Single source of truth.** Scope, decisions and the task list live here. If it's not in this file, it's not in scope. Progress notes go in [PROGRESS.md](PROGRESS.md).

**Deadline:** Friday 2026-10-02
**Brief:** "Product Engineer – Written Test – LILA.pdf"
**Users:** Level Designers (not data scientists). Keep UI plain and self-explanatory.
**Effort budget:** brief expects 10–15h focused work.

## 0. Principles (from brief)

- **Quality over quantity**: 4 polished features beat 10 half-working ones. No extras until R1–R8 are solid.
- **Attention to detail**: brief names the traps explicitly: coordinate mapping, bytes encoding, bot detection, timestamps (all covered in §4).
- **Document assumptions**: anything ambiguous: pick a sane default, log it in §4, surface it in ARCHITECTURE.md. Don't block.
- **Usable without help**: reviewer must open URL and use it cold: sensible default view, legend, empty/loading states, no setup.
- **AI use permitted and expected.**

## 0.1 How we're graded

| Area | What they check | Where we answer it |
|---|---|---|
| System design | Sensible stack/architecture, pipeline makes sense | §1, ARCHITECTURE.md |
| Attention to detail | Coords mapped right, events accurate, edge cases handled | §4, R2, R4 |
| End-to-end execution | Works, hosted, usable without us | R8, D2, principle "usable without help" |
| Product thinking | Useful to a LD, right things filterable/interactive | §5, R5–R7 |
| Code quality | Organized, readable, structured | `scripts/`, `src/` layout |
| Communication | Architecture doc explains decisions + tradeoffs | D4 |

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Stack | Vite + React + TypeScript, Canvas 2D rendering |
| Data pipeline | Offline Python preprocessing (`scripts/preprocess.py`) → static JSON |
| Hosting | GitHub Pages, project repo `vicky2315/lila-assessment` → `https://vicky2315.github.io/lila-assessment/` |
| Data in repo | Processed JSON + downscaled minimaps only. Raw `player_data/` NOT committed |
| Backend | None (fully static) |
| Machines | Work laptop (Wed) + personal laptop (Thu, Fri). Git repo is the only handoff. See §1.1 |

## 1.1 Two-laptop rules

- Everything needed to build and deploy lives in the repo, including processed data in `public/`. Push at end of each session.
- No absolute paths, no machine-specific config in code. `.venv/`, `node_modules/`, raw `player_data/` are gitignored and rebuilt per machine.
- Setup on a new machine: `git clone`, then Node 24 (`.nvmrc`) and `npm install`. Python 3.10+ and raw `player_data/` only needed to re-run preprocessing.
- Git author must be the personal identity, not the work one. Set per repo: `git config user.email <personal email>`.
- Claude memory is per machine. Project rules for Claude live in `CLAUDE.md` in the repo.

## 2. Core requirements (from brief, all must ship)

| ID | Requirement | Status |
|---|---|---|
| R1 | Load and parse provided parquet data (done offline by `preprocess.py`; app loads derived JSON) | ☐ |
| R2 | Player journeys on correct minimap, world coords mapped correctly | ☐ |
| R3 | Humans vs bots visually distinct | ☐ |
| R4 | Distinct markers: kills, deaths, loot, storm deaths | ☐ |
| R5 | Filter by map, date, match | ☐ |
| R6 | Timeline / playback of a match | ☐ |
| R7 | Heatmaps: kill zones, death zones, traffic | ☐ |
| R8 | Hosted, shareable link | ☐ |

## 3. Deliverables (repo must contain)

| ID | Deliverable | Status |
|---|---|---|
Submission = **one GitHub repo link**. Doc/Drive links are rejected, so everything must be inside the repo.

| ID | Deliverable | Status |
|---|---|---|
| D1 | All source code for the tool | ☐ |
| D2 | Working deployment URL (in README) | ☐ |
| D3 | README: tech stack, setup steps, env vars (state "none" explicitly) | ☐ |
| D4 | ARCHITECTURE.md, **max 1 page**: (a) what built with + why, (b) data flow parquet → screen, (c) coordinate mapping walkthrough ("the tricky part"), (d) assumptions where data ambiguous + how handled, (e) major tradeoffs table | ☐ |
| D5 | INSIGHTS.md: 3 insights **found using the tool**. Each: (a) what caught eye, (b) evidence (pattern or stat), (c) actionable? metrics affected + action items, (d) why LD should care | ☐ |
| D6 | Walkthrough covering all major features (format not specified → short video/GIF, linked in README, file or link inside repo) | ☐ |

## 3.1 Brief's pre-submit checklist (verbatim, tick at end)

- [ ] Tool is live at the hosted URL
- [ ] Player paths render correctly on the minimap
- [ ] Can tell humans apart from bots visually
- [ ] Kill, death, loot, and storm events are marked
- [ ] Filtering by map/date/match works
- [ ] Timeline or playback shows match progression
- [ ] Heatmaps show kill zones, death zones, and traffic
- [ ] Architecture doc covers coordinate mapping approach
- [ ] Three insights with supporting evidence
- [ ] Walkthrough covers all major features

## 4. Data rules (verified against raw data)

| Rule | Detail |
|---|---|
| Timestamps | `ts` typed `timestamp[ms]` but integer is **unix seconds**. Use raw int as seconds. Gives Feb 10–14 2026 UTC, ~5s position sampling, matches up to ~15 min |
| Coordinates | 2D plot uses `x`, `z` only (`y` = elevation). `u=(x-ox)/scale`, `v=(z-oz)/scale`, `px=u*W`, `py=(1-v)*H` |
| Map config | AmbroseValley 900/-370/-473 · GrandRift 581/-290/-290 · Lockdown 1000/-500/-500 |
| Minimap size | README says 1024². Actual sizes are 4320², 2160×2158, 9000². Map via UV, never hardcode 1024 |
| Bot detection | Numeric `user_id` = bot, UUID = human (per README). 17 bot-ID files contain `Position`/`Loot`. Keep ID rule, note anomaly |
| Events | `event` stored as bytes → decode UTF-8. 8 types: Position, BotPosition, Kill, Killed, BotKill, BotKilled, KilledByStorm, Loot |
| Duplicates | 1,505 exact duplicate rows → drop |
| Match date | Use earliest day folder (1 match crosses midnight Feb 10→11) |
| Match shape | 743/796 matches have 1 file (1 human, bots only visible via BotKill events). Human-vs-human Kill only 3 rows |

## 5. UX spec

- **Left sidebar:** map selector, date multi-select, match list (sortable, shows duration/humans/bots/kills), show humans / show bots toggles, event-type toggles.
- **Main:** minimap canvas, pan + zoom, paths (humans solid bright, bots dashed muted), event markers with distinct shape+color, hover tooltip.
- **Bottom bar:** play/pause, speed (1×/5×/10×/20×), scrubber with elapsed mm:ss.
- **Heatmap mode:** layer select (traffic / kills / deaths / storm / loot), respects map + date filters; opacity slider.
- **Legend** always visible.
- **URL state:** map/date/match/layer in URL hash so a view is shareable.

## 6. Task list

### Day 1: Wed 09-30
- [x] Read brief, probe data, confirm quirks
- [x] Lock decisions (stack, host, data policy)
- [x] Write REQUIREMENTS.md + PROGRESS.md, verify against brief
- [x] `scripts/preprocess.py` → index / matches / heat JSON + webp minimaps
- [x] Validate output (row counts, sample coordinate vs README example → px (78, 890) on 1024, visual overlay on all 3 maps)
- [x] Repo hygiene for two laptops: `.gitignore`, `.nvmrc`, `CLAUDE.md`
- [x] Git init, personal git identity, first push (commit 3a39ac0)
- [ ] Vite + React + TS scaffold, `base: /lila-assessment/`
- [ ] GitHub Actions Pages workflow; skeleton live at URL
- [ ] End of day: push everything so personal laptop can clone

### Day 2: Thu 10-01
- [ ] Map canvas: minimap render, pan/zoom, UV→px transform
- [ ] Paths + human/bot styling
- [ ] Event markers + legend + tooltip
- [ ] Filters: map, date, match list
- [ ] Timeline playback
- [ ] Heatmaps (aggregate + per-match)
- [ ] URL state

### Day 3: Fri 10-02
- [ ] Polish, empty/loading/error states, edge cases
- [ ] Find 3 insights using tool
- [ ] README, ARCHITECTURE.md, INSIGHTS.md
- [ ] Record walkthrough
- [ ] Final checklist pass (brief p.5–6), submit repo link
