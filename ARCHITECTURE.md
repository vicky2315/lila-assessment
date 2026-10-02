# Architecture

## What it is built with, and why

| Choice | Why |
|---|---|
| **Offline Python preprocessing** (pyarrow, pandas) | Browsers can't read parquet without a large extra library, and there are 1,243 files. The data quirks (timestamps, byte-encoded events, coordinates) are fixed once, in one place. The browser only gets what it draws, and each match loads only when opened. A separate script (`scripts/audit/verify_data.py`) rebuilds everything from raw and checks the output: 89,104 rows in, 89,104 out. |
| **No backend**, static JSON | Nothing can go down or leak. No keys, no env vars. |
| **React + TypeScript + Vite** | TypeScript types mirror the JSON shapes (`src/types.ts`), so a mismatch between pipeline and app fails the build. React keeps the sidebar, legend, timeline and URL in sync from one state. Vite gives a fast dev server and a plain static build. React is the only runtime dependency: the app is 76 KB gzipped. |
| **Canvas 2D** | Minimap, heatmap, paths and markers drawn in one surface that shares zoom and pan. |
| **GitHub Pages** | Quick to host: every push to `main` deploys by itself in under a minute, free for a public repo. The code sits next to the site, so anyone can open the repo, read it and run it. The live site is built from that exact code by a public Actions log. |

## Data flow

```
player_data/ (1,243 parquet files, one per player per match)
   |  scripts/preprocess.py
   |  decode events, read ts as seconds, world (x, z) -> map (u, v), group by match,
   |  count heat grids per map / day / layer, shrink minimaps to 2048 px WebP
   v
public/data/index.json          one row per match (map, day, start, length, counts)
public/data/matches/<id>.json   paths and events for one match, loaded when opened
public/data/heat/<map>.json     pre-counted heat grids
public/minimaps/<map>.webp
   |  GitHub Actions: npm run build -> GitHub Pages
   v
Browser: map (u, v) -> screen pixels, drawn on a canvas with zoom, pan and playback
```

## Coordinate mapping

Each map has a `scale` and origin (`ox`, `oz`) from the dataset README. `y` is height, so the 2D map uses only `x` and `z`.

```
u = (x - ox) / scale          0 to 1 across the map
v = (z - oz) / scale          0 to 1 up the map
px = u * imageWidth
py = (1 - v) * imageHeight    image y grows down, world z grows up
```

README example, Ambrose Valley, `x = -301.45, z = -355.55`: `u = 0.0762, v = 0.1305`, giving pixel (78, 890) on a 1024 px image. The pipeline gives the same.

The pipeline stores `u, v`, not pixels. The README says the minimaps are 1024 px, but they are really 4320, 2160 and 9000 px, so pixels are only worked out in the browser at the size the map is drawn. Checked by drawing every path on each map: paths follow roads and stay out of rocks and water.

## Assumptions

| Data question | How it is handled |
|---|---|
| `ts` is typed as milliseconds, but read that way every match lasts under a second | Read as unix seconds. Gives Feb 10 to 14, 2026 and matches of up to 15 minutes |
| Bot or human? | Numeric `user_id` = bot, UUID = human, as the README says |
| 1,505 exact duplicate rows | Kept. The data is shown as recorded |
| `BotKill` / `BotKilled` inside bot files (the README only defines them for humans) | Shown with the raw event name, no guessed meaning |
| One match crosses midnight; some matches start just before midnight of the day before their folder | Filed under the earliest day folder; date shown from the timestamp |

## Tradeoffs

| Choice | Gain | Cost |
|---|---|---|
| Static site, no backend | Free, nothing to run | New data means re-running the pipeline and pushing |
| JSON, not a binary format | Easy to read and debug | Larger files (fine at 4.3 MB total) |
| Pre-counted heat grids | Day filters are instant | Fixed cell size (128 per side, 64 for one match) |
| Minimaps shrunk to 2048 px | 24 MB down to 0.55 MB | Less detail at high zoom |
