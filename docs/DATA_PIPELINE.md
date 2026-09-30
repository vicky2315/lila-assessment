# Data Pipeline: How the Raw Data Was Parsed

A learning guide. It explains what the raw data looks like, how each problem in it was found, and how `scripts/preprocess.py` turns it into what the web app loads.

Read it in order. Each section builds on the one before.

---

## 1. The raw data

### What we were given

```
player_data/
  February_10/ ... February_14/   1,243 data files (1,242 unique names: one match crosses midnight, so the same player+match file name appears in both Feb 10 and Feb 11)
  minimaps/                       3 map images
  README.md                       schema, map config, coordinate formula
```

Each data file is **one player (or bot) in one match**. The file name is `{user_id}_{match_id}.nakama-0`.

### What parquet is

Parquet is a file format for tables. It stores data by column instead of by row, which makes it small and fast to read. It also stores the type of each column (string, float, timestamp), so you don't have to guess.

The files have no `.parquet` extension, but they are still parquet. The `pyarrow` library opens them if you pass the path directly:

```python
import pyarrow.parquet as pq
df = pq.read_table("player_data/February_10/<file>").to_pandas()
```

### The columns

| Column | Type | Meaning |
|---|---|---|
| `user_id` | string | Player ID. UUID = human, number = bot |
| `match_id` | string | Match ID, with a `.nakama-0` suffix |
| `map_id` | string | `AmbroseValley`, `GrandRift` or `Lockdown` |
| `x`, `y`, `z` | float32 | World position. `y` is height, so the 2D map uses only `x` and `z` |
| `ts` | timestamp[ms] | When the event happened (see section 2.1, this one is tricky) |
| `event` | bytes | Event type, stored as raw bytes like `b'Position'` |

---

## 2. Problems found in the data, and how

Before writing the pipeline, two probe scripts loaded every file into one table and asked questions about it. Each problem below says what looked wrong, what was tested, and what fixed it.

Scripts: `scripts/explore/01_probe_schema.py` and `scripts/explore/02_probe_structure.py`.

### 2.1 Timestamps are seconds, not milliseconds

**What looked wrong.** The column is typed as milliseconds. Read that way:
- every timestamp falls on 21 January 1970, and
- the longest match lasts 0.89 seconds, with the typical match at 0.38 seconds.

A shooter match can't last under a second.

**The test.** Take the raw integer behind the README's sample row and read it both ways:

```
raw integer:   1,770,727,161
as ms      ->  1970-01-21 11:52:07   (wrong: 1970)
as seconds ->  2026-02-10 12:39:21   (right: Feb 10 2026)
```

**The proof.** Read as seconds, every row lands on the same date as its folder name (`February_10` rows fall on 10 Feb 2026 UTC, and so on). Matches then last 13 to 890 seconds (up to about 15 minutes, typically about 6), and positions are sampled every 5 seconds. All of that is realistic.

**The fix.** Take the integer value directly and treat it as unix seconds:

```python
df["sec"] = df["ts"].astype("int64")
```

### 2.2 The event column is bytes

**What looked wrong.** Values print as `b'Position'`, not `Position`. Comparing them to plain strings silently fails.

**The fix.** Decode every value to text:

```python
df["event"] = df["event"].map(lambda b: b.decode("utf-8"))
```

After decoding, all values belong to the 8 known event types. The script warns if it ever sees a new one.

### 2.3 Bots: the ID rule works, but bot files are not "pure"

**The README rule.** A numeric `user_id` is a bot. A UUID is a human.

**What we checked.** Do bot files only contain `Bot*` events? Mostly, but 17 bot files also contain `Position` or `Loot` events, which the README says are human-only.

**The decision.** Keep the ID rule. It is the rule the README defines, it is unambiguous, and it matches the file names. The 17 files are noted as an anomaly. Do **not** decide "bot or human" from the event name, or those 17 would be misclassified.

```python
BOT_ID = re.compile(r"^\d+$")
df["is_bot"] = df["user_id"].map(lambda u: bool(BOT_ID.match(u)))
```

### 2.4 Duplicate rows

**What we found.** 1,505 rows are exact copies: same player, match, second, event and position.

| Event | Duplicates |
|---|---|
| Loot | 1,253 |
| Position / BotPosition | 210 |
| BotKill | 39 |
| BotKilled | 3 |

**The decision.** Treat them as double logging and drop them. Picking up 2 items in the same second at the exact same spot is possible, but keeping the duplicates would inflate the loot heatmaps. This is an assumption and it goes in ARCHITECTURE.md.

### 2.5 The minimaps are not 1024 pixels

**What the README says.** The images are 1024x1024.

**What they actually are.**

| Map | Real size |
|---|---|
| AmbroseValley | 4320 x 4320 |
| GrandRift | 2160 x 2158 (not quite square) |
| Lockdown | 9000 x 9000 (12 MB) |

**The fix.** Never hardcode 1024. Convert positions to UV (a 0 to 1 range, see section 4) and multiply by whatever the image size is. Then resizing the images can never break the mapping.

### 2.6 How a match is shaped

- **Most matches are solo.** 743 of 796 matches have only 1 file: one human. The bots they fought have no file of their own and only show up as `BotKill` / `BotKilled` events in the human's file.
- **Humans rarely kill humans.** Human vs human kills (`Kill`) happen only 3 times in 5 days.
- **Matches with bot files have 4 to 15 bots.**
- **One match crosses midnight.** It has files in both `February_10` and `February_11`. It is filed under the earlier day.
- **Coordinates are clean.** Every row falls inside the map bounds, with none outside on any map.

---

## 3. The pipeline, step by step

File: `scripts/preprocess.py`. Run it from the repo root:

```
python scripts/preprocess.py --src ../player_data --out public
```

It runs 5 steps, in this order:

```
load_raw  ->  clean  ->  build_match (per match)  ->  build_heat  ->  export_minimaps
```

### Step 1: `load_raw`
Reads every file in every `February_*` folder into one big table. It adds a `day` column taken from the folder name, skips hidden files like `.DS_Store`, and reports any unreadable file (none were found).

### Step 2: `clean`
Applies every fix from section 2, in this order:
1. Decode `event` bytes to text.
2. Read `ts` as seconds.
3. Mark bots by ID.
4. Drop duplicates.
5. Convert `x`, `z` to `u`, `v` (see section 4).

Result: 87,599 clean rows.

### Step 3: `build_match`
Runs once per match and produces 2 things.

**A summary row** for the match list and filters:

```json
{"id":"e325a53a-...","map":"AmbroseValley","day":"February_10",
 "start":1770681535,"dur":744,"humans":1,"bots":0,"n":{"BotKill":4,"Loot":30}}
```

**A detail file** for drawing the match:

```json
{"id":"fbbc5d02-...","map":"AmbroseValley","start":1770927267,"dur":523,
 "players":[{"id":"5787de75-...","bot":false,
             "t":[0,15,20,25],"u":[0.2513,0.2524,0.2499,0.245],"v":[0.3139,0.3146,0.3245,0.3389]}],
 "events":[[1,"Loot",33,0.2295,0.2718]]}
```

Design choices in this format:
- **Times start at 0.** `t` is seconds since the match started, so the playback slider maps directly to it.
- **Tracks are columns.** `t`, `u` and `v` are separate arrays rather than a list of objects, so key names like `"t":` are not repeated for every point.
- **Events are short arrays:** `[playerIndex, type, t, u, v]`. `playerIndex` points into `players`.
- **Humans come first** in `players`, so they get the low indices.
- **Values are rounded to 4 decimals.** That is 0.2 px on a 2048 image, so no visible loss.

### Step 4: `build_heat`
For each map and each day, counts events into a 128 x 128 grid, one grid per layer:

| Layer | Events counted |
|---|---|
| traffic | Position, BotPosition |
| kills | Kill, BotKill |
| deaths | Killed, BotKilled, KilledByStorm |
| storm | KilledByStorm |
| loot | Loot |

The grids are **sparse**: only non-empty cells are stored, as `[cellIndex, count]`, where `cellIndex = row * 128 + col`. Most cells are empty, so this is much smaller than storing all 16,384 cells.

Grids are kept per day so the app can add up only the days the user selects.

### Step 5: `export_minimaps`
Shrinks each map to at most 2048 px and saves it as WebP. That cuts the 3 maps from 24 MB to 0.55 MB. The real sizes are saved in `index.json` for reference.

### Output

```
public/
  data/index.json               134 KB   map config + 796 match summaries
  data/matches/<id>.json        796 files, median 1.8 KB, largest 22 KB
  data/heat/<map>.json          3 files, 300 KB in total
  minimaps/<map>.webp           3 files, 556 KB in total
```

### Why preprocess at all

The browser could read the parquet files directly, but then:
- it would download all 1,243 files and 24 MB of images before showing anything,
- the parquet library would add weight to the page,
- every data fix would have to live in front-end code.

Doing it once, offline, keeps the site fast, keeps all the data fixes in one readable Python file, and means the raw data never has to be published.

---

## 4. Coordinate mapping, worked through

The README gives each map a `scale` and an origin (`ox`, `oz`):

| Map | scale | ox | oz |
|---|---|---|---|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

**Step 1: world to UV.** Shift the position so the map's corner is at 0, then divide by the map's width in world units. That gives a value from 0 to 1 across the map.

```
u = (x - ox) / scale
v = (z - oz) / scale
```

**Step 2: UV to pixels.**

```
px = u * imageWidth
py = (1 - v) * imageHeight
```

Why `1 - v`: in the game world, `z` grows "up" the map. In an image, `y` grows *down* from the top-left corner, so `v` must be flipped.

**Worked example** (from the README, AmbroseValley, point `x = -301.45`, `z = -355.55`):

```
u  = (-301.45 - (-370)) / 900 = 68.55 / 900  = 0.0762
v  = (-355.55 - (-473)) / 900 = 117.45 / 900 = 0.1305
px = 0.0762 * 1024        = 78
py = (1 - 0.1305) * 1024  = 890
```

Our pipeline gives (78, 890), which matches the README.

**Where it's done.** Step 1 runs in the pipeline, so the JSON stores `u`, `v`. Step 2 runs in the browser, because only the browser knows the size the map is drawn at (it changes with zoom and window size).

**Visual check.** `scripts/explore/04_overlay_paths.py` draws every path on each map. Paths follow roads, go around Lockdown's rocks, and stay out of the water. If the mapping were wrong (a flipped axis or a wrong origin), paths would cross walls or leave the map.

---

## 5. Try it yourself

Setup, once per machine. The raw `player_data/` folder must sit next to the repo folder.

```
python -m venv .venv
.venv\Scripts\activate            (Windows)
source .venv/bin/activate         (Mac / Linux)
pip install -r scripts/requirements.txt
```

Run from the repo root:

| Command | What you'll see |
|---|---|
| `python scripts/explore/01_probe_schema.py` | Column types, event counts, human vs bot table, map bounds, match durations (in "ms", the wrong reading), duplicates |
| `python scripts/explore/02_probe_structure.py` | Timestamps as real 2026 dates per folder, event mixes in bot and human files, files per match |
| `python scripts/preprocess.py --src ../player_data --out public` | Builds everything in `public/` in about 10 seconds |
| `python scripts/explore/03_validate_output.py` | Totals, heatmap sums, and the README example printed as `78 890` |
| `python scripts/explore/04_overlay_paths.py` | Writes path overlay images to `scripts/explore/out/` |

**Exercises to learn from:**
1. In `02_probe_structure.py`, change `unit="s"` to `unit="ms"` and see the dates collapse to 1970.
2. In `04_overlay_paths.py` line 11, change `(1-v)*H` to `v*H` and re-run it. The paths flip upside down and cross walls and water. This shows why the `1 - v` flip matters.
3. Classify bots by event name instead of ID and count how many files change group. You should find the 17 anomaly files.
