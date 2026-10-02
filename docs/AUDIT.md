# Audit: 2026-09-30

A full check of the tool: data, UI, code, repo, deployment and docs. Each step says what was checked, why, how to re-run it, what was found and what was fixed.

**Result:** all checks pass after fixes. 8 real issues found and fixed (§5). 3 interpretations decided by the user and applied (§3.2).

**Rules this audit follows** (REQUIREMENTS §0.0): present data as is, no new or derived datasets; small screens are not a priority.

| Step | What | Result |
|---|---|---|
| 1 | Requirements coverage | R1 to R8 met. D2 to D6 still to do (Day 3) |
| 2 | Data: re-derive every output from raw | PASS, 0 problems |
| 3 | "As is" review: every transform between raw and screen | 12 listed, 3 decided and applied |
| 4 | UI: scripted real browser | PASS, 25/25 checks |
| 5 | Code review | 8 issues, all fixed |
| 6 | Repo and privacy | Clean |
| 7 | Deployment | 804/804 files live |
| 8 | Docs | 2 corrections made |

---

## 1. Requirements coverage

**What.** Compared every requirement (R1 to R8), deliverable (D1 to D6) and the brief's own checklist against what is built.

**Why.** The brief grades "end-to-end execution" and gives an explicit checklist. Anything missing is a lost mark.

**Result.**
- R1 to R8 are all built, and steps 2, 4 and 7 verify them. Status is updated in REQUIREMENTS §2 with the step that proves each one.
- D1 (source code) is done.
- D2 to D6 (README with URL, ARCHITECTURE.md, INSIGHTS.md, walkthrough) are Day 3 work, as planned.
- Brief checklist: 7 of 10 are ticked. The remaining 3 are the docs and the walkthrough.

---

## 2. Data: re-derive every output from raw

**What.** `scripts/audit/verify_data.py` re-reads all raw parquet files and rebuilds everything the site shows, then compares:
- every match file: map, start time, duration, player list, bot flags, every track point (time and position) and every event (type, time, position),
- every index row: day, start, duration, humans, bots, event counts,
- every heat grid cell, for every map, day and layer,
- the map config against the README, and the README worked example (78, 890).

**Why.** "Attention to detail" is graded. The pipeline could be wrong in ways screenshots never show. The audit script does **not** import `preprocess.py`: it re-implements every rule from the README, so it catches mistakes in the pipeline instead of repeating them.

**How to re-run** (needs `../player_data`):
```
python scripts/audit/verify_data.py
```

**Result: PASS, 0 problems.** 1,243 files, 89,104 rows, 796 matches. After decision A the audit also checks that the output holds every raw row: 89,104 in, 89,104 out.

**What went wrong on the way (and what it teaches).** The first two runs failed, both from bugs in the audit script, not the pipeline:

| Run | Symptom | Cause | Lesson |
|---|---|---|---|
| 1 | 1,592 mismatches, all start times off by exactly 19,800 s | Converting `ts` through Python `datetime.timestamp()` applies the laptop's timezone (IST, +5:30 = 19,800 s) | Never go through local datetimes. Read the raw int64 directly |
| 2 | 1 event position mismatch | 2 bot kills by one player in the same second, x differing by 0.0006. Sorting raw values then comparing to rounded ones swapped them | Round first, then sort, when comparing to rounded output |
| 3 | PASS | | |

**New fact found.** The README's 1,243 files is correct. My first probe said 1,242 because it grouped by file *name*, and one name appears in both `February_10` and `February_11`: the match that crosses midnight. Corrected in DATA_PIPELINE.md and PROGRESS.md.

---

## 3. "As is" review

**What.** Every place where data is changed, rounded, grouped or interpreted between the raw files and the screen.

**Why.** User rule: present the data as is. Anything beyond what is needed to read and draw the data must be visible and approved.

### 3.1 Needed to read or draw the data (no decision needed)

| # | Transform | Why it is needed | Loss |
|---|---|---|---|
| 1 | Decode `event` bytes to text | Raw values are bytes | None |
| 2 | Read `ts` as unix seconds | Typed as ms but stored as seconds (DATA_PIPELINE §2.1) | None, raw integer kept |
| 3 | World (x, z) to UV, rounded to 4 decimals | README formula, needed to place points on the image | Under 0.2 px at 2048 |
| 4 | Minimaps shrunk to 2048 px WebP | 24 MB of images would make the site unusable | Image detail only |
| 5 | Times shown relative to match start | Playback needs a 0-based clock | None, start time kept |
| 6 | Bot = numeric `user_id` | README rule | None |
| 7 | Match filed under earliest day folder, date shown from timestamp | 1 match crosses midnight; folder and clock disagree for pre-midnight starts | None |
| 8 | Heat grids: counts per cell (128 grid all matches, 64 grid per match) | The brief requires heatmaps; a heatmap is a count per area | Position within a cell |
| 9 | Heat colour scale: capped at the 98th percentile, gamma 0.6, blurred | Otherwise one hot cell makes the rest invisible | Visual only; the hottest 2% of cells show the same top colour |
| 10 | Minimap drawn in grey at 70% brightness while a heatmap is on | GrandRift's minimap has red and orange zones painted on, which hid the heat colours | Visual only; map colours return when heat is off |
| 11 | Heat "Intensity" slider (1× to 5×, default 1×) multiplies colour alpha after the blur | Sparse layers (e.g. GrandRift kills, 193 events) blur out too thin to see | Visual only; cell colours and counts unchanged |

### 3.2 Interpretations (decided by the user, 09-30)

| # | What the tool does now | Why it is an interpretation | Options |
|---|---|---|---|
| A | **Drops 1,505 exact duplicate rows** (1,253 of them Loot) | They could be real (2 pickups, same second, same spot) or double logging. Dropping changes loot counts by about 10% | Keep dropping (current), or keep all rows as recorded |
| B | **Tooltip wording for events in bot files.** "Bot was killed" for `BotKilled`, "Bot got a kill" for `BotKill` | The README only defines these from the human side. The meaning in a bot's file is my guess | Keep the wording (current), or show the raw event name, e.g. "BotKilled (in bot's file)" |
| C | **Smooth playback.** The position dot slides between 5 s samples, and paths are straight lines between samples | Positions between samples are not in the data | Keep sliding (current), or jump from sample to sample |

**Decisions:**

| # | Decision | Done |
|---|---|---|
| A | **Keep every row**, duplicates included. No modification of given data | Dedupe removed from `preprocess.py`. Data rebuilt. Audit now asserts 89,104 rows in = 89,104 out: PASS |
| B | **Show the raw name.** A BotKilled in a bot's file might mean a bot killed by another bot, so no guessing | Tooltips, timeline ticks and legend titles all show the raw event name. README meaning is added only for human files |
| C | **Keep smooth playback** | No change |

Nothing else in the tool adds or derives data.

---

## 4. UI: scripted real browser

**What.** `scripts/audit/ui_check.mjs` drives the built site in headless Chrome and clicks through every feature: match list, open match, play, pause with space, resume, scrub, speed, pan, zoom, legend toggles, heat scope and layer, shared-link reload, map switch, no-days state, all 3 map images, broken links, console errors.

**Why.** Static screenshots cannot check playback, dragging or keyboard input. The browser extension was not connected, so this script replaces a manual click-through.

**How to re-run:**
```
npm i --no-save puppeteer-core
npm run build && npx vite preview --port 4173
node scripts/audit/ui_check.mjs
```
`--no-save` keeps puppeteer out of `package.json`: it is an audit tool, not part of the app.

**Result: PASS, 25/25.** The first run was 19/22:

| Failure | Cause | Fix |
|---|---|---|
| Hiding loot did not change the map | Test bug: playhead was at 0:30, first loot is at 0:45 | Test moves the playhead to the end first |
| Unticking every day did nothing | **Real bug**, see §5 #1 | Fixed |
| Console error (404) | Browser asks for `/favicon.ico` | Inline icon in `index.html` |

---

## 5. Code review

**What.** Read every source file looking for crashes, wrong behaviour, stale state and wasted work.

**Why.** "Code quality" is graded, and reviewers will poke at the tool.

| # | Issue | Effect | Fix | File |
|---|---|---|---|---|
| 1 | Empty day selection written as an empty URL value, which means "all days" | Unticking the last day re-selected every day | Store it as `days=none` | `App.tsx` |
| 2 | `layer` from the URL not validated | `#layer=foo` crashed the app | Unknown values fall back to Traffic | `App.tsx` |
| 3 | Space bar taken over even with no match open | Space could not press a focused button | Only handle space when a match is open | `App.tsx` |
| 4 | A shared link's match was used for a moment before the map switched | Per-match heat, legend and timeline could briefly show a match from another map | Only use the match if it belongs to the map on screen | `App.tsx` |
| 5 | Heatmap load failure was silent | Missing heatmap, no message | Show "Could not load heatmap" | `App.tsx` |
| 6 | Canvas buffer reset on every frame | Wasted work during playback | Only resize when the size changes | `MapView.tsx` |
| 7 | Tooltip stayed after scrubbing back past its marker | Tooltip for a marker no longer drawn | Hide it when the marker is in the future | `MapView.tsx` |
| 8 | "Partial day" note assumed the last day | Wrong if the data changes | Names Feb 14 explicitly, as the README does | `Sidebar.tsx` |

Checked and fine: the pipeline logic (confirmed by step 2), map/days/match URL fallbacks, fetch caching and retry, human/bot toggles in paths, markers and per-match heat, heat grid orientation (same `1 - v` flip in Python and TypeScript, confirmed by step 2 and the overlay).

---

## 6. Repo and privacy

**What.** Searched the full git history, not just the latest files.

**Why.** The repo is public. Raw production data, the work email or machine paths must not be in it, and git history keeps deleted files forever.

**Result: clean.**
- Every commit (7 at audit time) is by `Vignesh <vigneshvinith23157@gmail.com>`.
- No raw data (`.nakama-0`, `player_data`, parquet) in any commit.
- The work email or domain does not appear in any version of any file.
- No absolute machine paths in tracked files.
- One stray file in history: `tsconfig.tsbuildinfo` (TypeScript build cache, removed in the next commit). It only lists relative file names, so it is harmless. History was not rewritten.
- `.git` is 3.8 MB. The largest file is 200 KB.

---

## 7. Deployment

**What.** Requested every file the app can load from the live site.

**Why.** GitHub Pages runs on Linux, where file names are case-sensitive. A file that works locally on Windows can 404 live.

**Result.** 804/804 return 200: 796 matches, 3 heat files, 3 minimaps, index, page. `index.json` transfers as 30 KB gzipped.

---

## 8. Docs

**What.** Checked that the docs match the code and data, and that there are no em dashes (user rule).

**Result.**
- File count corrected from 1,242 to 1,243 (DATA_PIPELINE.md, PROGRESS.md).
- REQUIREMENTS status columns were never updated. R1 to R8, D1 and the brief checklist now show what is done, with the audit step that proves it.
- No em dashes in any tracked file.

---

## Final check: 2026-10-02

Run before submission, on the personal laptop (raw data not on this machine).

| Check | Result |
|---|---|
| Data unchanged since the full raw check (`de2b7e1`) | No change to `public/data`, minimaps or `preprocess.py` since then |
| Match files vs index vs heat files | PASS, 0 problems: 89,104 rows, 796 matches, heat totals match events on 3 maps x 5 layers, all positions inside the map, bot flags match the ID rule |
| README coordinate example | (78, 890), matches |
| UI audit on the live site | PASS, 25/25 |
| Links and images in all docs | None broken |
| Em dashes | None |

