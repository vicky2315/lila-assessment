"""
Preprocess raw LILA BLACK telemetry (parquet) into compact static JSON for the web app.

Usage:
    python scripts/preprocess.py --src ../player_data --out public

Outputs:
    public/data/index.json              map config + one summary row per match
    public/data/matches/<match>.json    per-match player tracks + discrete events
    public/data/heat/<map>.json         pre-binned heat grids per day per layer
    public/minimaps/<map>.webp          downscaled minimap images
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # Lockdown minimap is 9000x9000

# From the dataset README. World (x, z) -> UV: u = (x - ox) / scale, v = (z - oz) / scale.
MAPS = {
    "AmbroseValley": {"scale": 900, "ox": -370, "oz": -473, "image": "AmbroseValley_Minimap.png"},
    "GrandRift": {"scale": 581, "ox": -290, "oz": -290, "image": "GrandRift_Minimap.png"},
    "Lockdown": {"scale": 1000, "ox": -500, "oz": -500, "image": "Lockdown_Minimap.jpg"},
}

EVENTS = ["Position", "BotPosition", "Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"]
MOVEMENT = {"Position", "BotPosition"}

HEAT_BINS = 128
HEAT_LAYERS = {
    "traffic": {"Position", "BotPosition"},
    "kills": {"Kill", "BotKill"},
    "deaths": {"Killed", "BotKilled", "KilledByStorm"},
    "storm": {"KilledByStorm"},
    "loot": {"Loot"},
}

MINIMAP_MAX_PX = 2048
BOT_ID = re.compile(r"^\d+$")


def load_raw(src: Path) -> pd.DataFrame:
    frames = []
    for day_dir in sorted(p for p in src.iterdir() if p.is_dir() and p.name.startswith("February_")):
        for f in day_dir.iterdir():
            if f.name.startswith("."):
                continue
            try:
                t = pq.read_table(f).to_pandas()
            except Exception as e:  # corrupt / non-parquet file: skip but report
                print(f"  skip {f.name}: {e}")
                continue
            t["day"] = day_dir.name
            frames.append(t)
    return pd.concat(frames, ignore_index=True)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    # event is stored as raw bytes
    df["event"] = df["event"].map(lambda b: b.decode("utf-8") if isinstance(b, (bytes, bytearray)) else str(b))

    # ts is typed timestamp[ms] but the stored integer is actually unix SECONDS.
    # Read as ms every match lasts < 1s and dates land in Jan 1970; read as seconds
    # they land on Feb 10-14 2026 (matching the folder names) and positions are sampled every ~5s.
    df["sec"] = df["ts"].astype("int64")

    # Bot detection per README: numeric user_id = bot, UUID = human.
    df["is_bot"] = df["user_id"].map(lambda u: bool(BOT_ID.match(u)))

    before = len(df)
    df = df.drop_duplicates(subset=["user_id", "match_id", "sec", "event", "x", "y", "z"])
    print(f"  dropped {before - len(df)} duplicate rows")

    unknown = set(df["event"]) - set(EVENTS)
    if unknown:
        print(f"  WARNING unknown events: {unknown}")

    cfg = df["map_id"].map(MAPS)
    df["u"] = (df["x"] - cfg.map(lambda c: c["ox"])) / cfg.map(lambda c: c["scale"])
    df["v"] = (df["z"] - cfg.map(lambda c: c["oz"])) / cfg.map(lambda c: c["scale"])
    out = ~df["u"].between(0, 1) | ~df["v"].between(0, 1)
    if out.any():
        print(f"  WARNING {out.sum()} rows outside minimap bounds (kept, clamped at render)")
    return df


def match_file_id(match_id: str) -> str:
    return match_id.replace(".nakama-0", "")


def build_match(mid: str, g: pd.DataFrame) -> tuple[dict, dict]:
    g = g.sort_values(["sec", "user_id"])
    start = int(g["sec"].min())
    end = int(g["sec"].max())
    map_id = g["map_id"].iloc[0]

    players = []
    events = []
    # Humans first so they get stable low indices; bots after.
    order = sorted(g["user_id"].unique(), key=lambda u: (BOT_ID.match(u) is not None, u))
    for idx, uid in enumerate(order):
        pg = g[g["user_id"] == uid]
        mv = pg[pg["event"].isin(MOVEMENT)]
        players.append({
            "id": uid,
            "bot": bool(BOT_ID.match(uid)),
            # columnar track: relative seconds, u, v
            "t": (mv["sec"] - start).astype(int).tolist(),
            "u": mv["u"].round(4).tolist(),
            "v": mv["v"].round(4).tolist(),
        })
        for r in pg[~pg["event"].isin(MOVEMENT)].itertuples():
            events.append([idx, r.event, int(r.sec - start), round(r.u, 4), round(r.v, 4)])
    events.sort(key=lambda e: e[2])

    ev = g["event"].value_counts()
    summary = {
        "id": match_file_id(mid),
        "map": map_id,
        # earliest day folder containing the match (one match straddles midnight)
        "day": sorted(g["day"].unique(), key=lambda d: int(d.split("_")[1]))[0],
        "start": start,
        "dur": end - start,
        "humans": int((~g.drop_duplicates("user_id")["is_bot"]).sum()),
        "bots": int(g.drop_duplicates("user_id")["is_bot"].sum()),
        "n": {e: int(ev.get(e, 0)) for e in EVENTS if e not in MOVEMENT and ev.get(e, 0)},
    }
    detail = {"id": summary["id"], "map": map_id, "start": start, "dur": end - start,
              "players": players, "events": events}
    return summary, detail


def build_heat(df: pd.DataFrame) -> dict[str, dict]:
    heat = {}
    for map_id, mg in df.groupby("map_id"):
        days = {}
        for day, dg in mg.groupby("day"):
            layers = {}
            for layer, evs in HEAT_LAYERS.items():
                sub = dg[dg["event"].isin(evs)]
                col = (sub["u"].clip(0, 0.9999) * HEAT_BINS).astype(int)
                row = ((1 - sub["v"]).clip(0, 0.9999) * HEAT_BINS).astype(int)  # image row, top = 0
                counts = (row * HEAT_BINS + col).value_counts().sort_index()
                layers[layer] = [[int(i), int(c)] for i, c in counts.items()]  # sparse [cell, count]
            days[day] = layers
        heat[map_id] = {"bins": HEAT_BINS, "days": days}
    return heat


def export_minimaps(src: Path, out: Path) -> dict[str, dict]:
    dims = {}
    (out / "minimaps").mkdir(parents=True, exist_ok=True)
    for map_id, cfg in MAPS.items():
        im = Image.open(src / "minimaps" / cfg["image"]).convert("RGB")
        orig = im.size
        im.thumbnail((MINIMAP_MAX_PX, MINIMAP_MAX_PX), Image.LANCZOS)
        im.save(out / "minimaps" / f"{map_id}.webp", "WEBP", quality=82)
        dims[map_id] = {"w": im.size[0], "h": im.size[1], "origW": orig[0], "origH": orig[1]}
        print(f"  {map_id}: {orig} -> {im.size}")
    return dims


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=Path("../player_data"))
    ap.add_argument("--out", type=Path, default=Path("public"))
    ap.add_argument("--skip-images", action="store_true")
    args = ap.parse_args()

    print("loading parquet...")
    df = clean(load_raw(args.src))
    print(f"  {len(df)} rows, {df['match_id'].nunique()} matches, {df['user_id'].nunique()} players")

    data_dir = args.out / "data"
    summaries = []
    for mid, g in df.groupby("match_id"):
        s, d = build_match(mid, g)
        summaries.append(s)
        write_json(data_dir / "matches" / f"{s['id']}.json", d)
    summaries.sort(key=lambda s: s["start"])

    for map_id, h in build_heat(df).items():
        write_json(data_dir / "heat" / f"{map_id}.json", h)

    dims = {} if args.skip_images else export_minimaps(args.src, args.out)
    maps = {m: {k: c[k] for k in ("scale", "ox", "oz")} | dims.get(m, {}) for m, c in MAPS.items()}
    write_json(data_dir / "index.json", {"maps": maps, "days": sorted(df["day"].unique(), key=lambda d: int(d.split("_")[1])),
                                         "matches": summaries})
    print(f"wrote {len(summaries)} matches to {data_dir}")


if __name__ == "__main__":
    main()
