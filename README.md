# LILA Player Journey Explorer

A web tool for level designers to see how players move, fight, loot and die on three maps: Ambrose Valley, Grand Rift and Lockdown. Built from 5 days of match telemetry (Feb 10 to 14, 2026).

**Live tool:** https://vicky2315.github.io/lila-assessment/

**Walkthrough:** _(to be added)_

## How to use it

The player data is already loaded. Nothing to install or upload. Use a desktop browser.

**See where things happen on a map**

1. Open the [live tool](https://vicky2315.github.io/lila-assessment/).
2. Pick a map at the top left: **Ambrose Valley**, **Grand Rift** or **Lockdown**. The number under each is how many matches it has.
3. Under **Days**, click a day to turn it on or off. **All** turns every day back on.
4. Under **Heatmap**, pick a layer: **Traffic** (where players walk), **Kills**, **Deaths**, **Storm deaths** or **Loot**. Brighter means more.
5. If the heatmap is hard to see, move **Intensity** to the right. **Opacity** fades it in and out.

**Watch one match**

1. Pick a match from the list on the left. Use **Search match ID** or the sort menu (**Longest**, **Most kills**, **Most bots**) to find one.
2. The map now shows every player's path. Solid bright lines are humans, dashed lines are bots.
3. Press **Play** at the bottom (or the space bar) to replay the match. Pick a speed: 1×, 5×, 10× or 20×.
4. Drag the time bar to jump to any moment.
5. Hover over a marker to see what happened and when. The legend at the top right shows what each marker means.
6. Click an item in the legend to hide or show it, for example hide bots or loot.
7. With a match open, the heatmap shows **This match** only. Click **All matches** to see the full heatmap under this match.

**Move around the map**

- Scroll to zoom, drag to move.
- **+** and **−** zoom, **Fit** shows the whole map again.

**Share what you see**

Copy the page address. It keeps the map, days, match and heatmap, so anyone who opens it sees the same view.

**Start over**

Click **Reset view** (next to **Map**) to go back to the default view.

## What it does

- Shows each player's path on the correct minimap. Humans are solid bright lines, bots are dashed and muted.
- Marks kills, deaths, loot pickups and storm deaths with distinct shapes and colours. Hover a marker for details.
- Filters by map, day and match. The match list can be searched and sorted.
- Replays a match with play, pause, speed (1× to 20×) and a scrubber.
- Heatmaps for traffic, kills, deaths, storm deaths and loot, across all matches or for the open match only. Opacity and intensity sliders.
- The legend doubles as toggles for humans, bots and each event type.
- The current view (map, days, match, heatmap) is kept in the URL, so a view can be shared as a link.

## Tech stack

| Part | Tools |
|---|---|
| Data pipeline (offline) | Python 3.10+, pyarrow, pandas, Pillow |
| Web app | React 19, TypeScript, Vite 8, Canvas 2D |
| Hosting | GitHub Pages, deployed by GitHub Actions on every push to `main` |

There is no backend. The app is a static site that loads pre-processed JSON.

## Run it locally

Needs Node 24 (see `.nvmrc`).

```
git clone https://github.com/vicky2315/lila-assessment.git
cd lila-assessment
npm install
npm run dev
```

Then open the URL Vite prints (http://localhost:5173/lila-assessment/).

To build the production site: `npm run build`, then `npm run preview`.

## Environment variables

None. The app needs no keys, accounts or config.

## Re-running the data pipeline (optional)

The processed data is already in `public/`, so this is only needed if the raw data changes. The raw data is not in this repo.

1. Put the raw `player_data/` folder next to this repo folder (`../player_data`).
2. `pip install -r scripts/requirements.txt`
3. `npm run preprocess`

## Repo layout

```
scripts/preprocess.py     raw parquet -> JSON in public/data + WebP minimaps
scripts/audit/            data and UI checks (see docs/AUDIT.md)
scripts/insights/         numbers and charts for INSIGHTS.md
scripts/explore/          the first scripts used to probe the raw data
src/                      the web app
public/data/              index.json, one file per match, heat grids per map
public/minimaps/          minimap images
docs/                     requirements, progress log, pipeline guide, audit
```

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md): what it is built with and why, data flow, coordinate mapping, assumptions, tradeoffs.
- [INSIGHTS.md](INSIGHTS.md): three insights found with the tool.
- [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md): how the raw data was parsed, step by step.
- [docs/AUDIT.md](docs/AUDIT.md): full check of data, UI, code and deployment.
