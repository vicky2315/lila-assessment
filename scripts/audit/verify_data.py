"""
Audit: independently re-derive every output file from the raw parquet and compare.

Does NOT import scripts/preprocess.py. The point is to catch mistakes in it,
so every rule here is re-implemented from the dataset README.

Run from repo root (needs ../player_data):
    python scripts/audit/verify_data.py
Exit code 0 = everything matches.
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

RAW = Path("../player_data")
OUT = Path("public/data")
MAPS = {"AmbroseValley": (900, -370, -473), "GrandRift": (581, -290, -290), "Lockdown": (1000, -500, -500)}
MOVE = {"Position", "BotPosition"}
LAYERS = {
    "traffic": {"Position", "BotPosition"},
    "kills": {"Kill", "BotKill"},
    "deaths": {"Killed", "BotKilled", "KilledByStorm"},
    "storm": {"KilledByStorm"},
    "loot": {"Loot"},
}
TOL = 1.5e-4  # outputs are rounded to 4 decimals

problems: list[str] = []


def fail(msg: str) -> None:
    problems.append(msg)
    if len(problems) <= 30:
        print("  MISMATCH", msg)


# ---- 1. Read raw with plain pyarrow (no pandas), one dict per row
rows = []
files = 0
empty: list[str] = []
for day in sorted(RAW.glob("February_*")):
    for f in sorted(day.iterdir()):
        if f.name.startswith("."):
            continue
        files += 1
        tbl = pq.read_table(f)
        # Read ts as its raw int64 (the stored number is unix seconds). Converting via datetime
        # would apply the local timezone: this bug hit the first audit run (+5:30 IST offset).
        tbl = tbl.set_column(tbl.schema.get_field_index("ts"), "ts", tbl.column("ts").cast(pa.int64()))
        if tbl.num_rows == 0:
            empty.append(f"{day.name}/{f.name}")
        t = tbl.to_pydict()
        uid_from_name, mid_from_name = f.name.split("_", 1)
        for i in range(len(t["x"])):
            ev = t["event"][i]
            ev = ev.decode("utf-8") if isinstance(ev, bytes) else ev
            sec = t["ts"][i]
            if t["user_id"][i] != uid_from_name or t["match_id"][i] != mid_from_name:
                fail(f"{f.name}: row user/match does not match file name")
            rows.append((t["user_id"][i], t["match_id"][i], t["map_id"][i], t["x"][i], t["y"][i], t["z"][i], sec, ev, day.name))
print(f"raw: {files} files, {len(rows)} rows, {len(empty)} empty files {empty}")

# ---- 2. Exact-duplicate removal (same key the README implies: player, match, time, event, position)
seen = set()
clean = []
for r in rows:
    key = (r[0], r[1], r[6], r[7], r[3], r[4], r[5])
    if key in seen:
        continue
    seen.add(key)
    clean.append(r)
print(f"after dedupe: {len(clean)} rows ({len(rows) - len(clean)} dropped)")


def uv(map_id, x, z):
    s, ox, oz = MAPS[map_id]
    return (x - ox) / s, (z - oz) / s


def uv4(map_id, x, z):
    """uv rounded like the output. Round BEFORE sorting: two events in the same second can
    differ only past the 4th decimal, and sorting unrounded values swaps them (hit on audit run 2)."""
    u, v = uv(map_id, x, z)
    return round(u, 4), round(v, 4)


is_bot = lambda uid: uid.isdigit()

# ---- 3. Group by match
by_match = defaultdict(list)
for r in clean:
    by_match[r[1]].append(r)

index = json.loads((OUT / "index.json").read_text(encoding="utf-8"))
idx_by_id = {m["id"]: m for m in index["matches"]}
if len(idx_by_id) != len(by_match):
    fail(f"index has {len(idx_by_id)} matches, raw has {len(by_match)}")

for mid, rs in by_match.items():
    fid = mid.replace(".nakama-0", "")
    path = OUT / "matches" / f"{fid}.json"
    if not path.exists():
        fail(f"missing match file {fid}")
        continue
    d = json.loads(path.read_text(encoding="utf-8"))
    start = min(r[6] for r in rs)
    end = max(r[6] for r in rs)
    maps = {r[2] for r in rs}
    if len(maps) != 1 or d["map"] not in maps:
        fail(f"{fid}: map {d['map']} vs raw {maps}")
    if d["start"] != start or d["dur"] != end - start:
        fail(f"{fid}: start/dur {d['start']}/{d['dur']} vs raw {start}/{end - start}")

    # players and tracks
    raw_players = {r[0] for r in rs}
    out_players = {p["id"]: p for p in d["players"]}
    if set(out_players) != raw_players:
        fail(f"{fid}: player set differs")
        continue
    for uid, p in out_players.items():
        if p["bot"] != is_bot(uid):
            fail(f"{fid}/{uid}: bot flag wrong")
        mv = sorted((r for r in rs if r[0] == uid and r[7] in MOVE), key=lambda r: r[6])
        if len(mv) != len(p["t"]):
            fail(f"{fid}/{uid}: {len(p['t'])} track points vs raw {len(mv)}")
            continue
        # compare as multisets per timestamp (order of same-second points may differ)
        want = sorted((r[6] - start, *uv4(r[2], r[3], r[5])) for r in mv)
        got = sorted(zip(p["t"], p["u"], p["v"]))
        for (wt, wu, wv), (gt, gu, gv) in zip(want, got):
            if wt != gt or abs(wu - gu) > TOL or abs(wv - gv) > TOL:
                fail(f"{fid}/{uid}: track point differs at t={wt}")
                break

    # discrete events
    raw_ev = sorted((r[0], r[7], r[6] - start) for r in rs if r[7] not in MOVE)
    ids = [p["id"] for p in d["players"]]
    got_ev = sorted((ids[e[0]], e[1], e[2]) for e in d["events"])
    if raw_ev != got_ev:
        fail(f"{fid}: events differ ({len(got_ev)} vs raw {len(raw_ev)})")
    raw_pos = sorted((r[0], r[7], r[6] - start, *uv4(r[2], r[3], r[5])) for r in rs if r[7] not in MOVE)
    got_pos = sorted((ids[e[0]], e[1], e[2], e[3], e[4]) for e in d["events"])
    for w, g in zip(raw_pos, got_pos):
        if w[:3] != g[:3] or abs(w[3] - g[3]) > TOL or abs(w[4] - g[4]) > TOL:
            fail(f"{fid}: event position differs {w[:3]}")
            break

    # index row
    s = idx_by_id.get(fid)
    if not s:
        fail(f"{fid}: not in index")
        continue
    cnt = Counter(r[7] for r in rs if r[7] not in MOVE)
    if s["n"] != {k: v for k, v in cnt.items()}:
        fail(f"{fid}: index counts {s['n']} vs raw {dict(cnt)}")
    humans = sum(1 for u in raw_players if not is_bot(u))
    if s["humans"] != humans or s["bots"] != len(raw_players) - humans:
        fail(f"{fid}: index humans/bots wrong")
    first_day = sorted({r[8] for r in rs}, key=lambda x: int(x.split("_")[1]))[0]
    if s["day"] != first_day or s["start"] != start or s["dur"] != end - start or s["map"] not in maps:
        fail(f"{fid}: index day/start/dur/map wrong")

print(f"checked {len(by_match)} match files + index rows")

# ---- 4. Heat grids: rebuild every map/day/layer and compare cell by cell
for map_id in MAPS:
    h = json.loads((OUT / "heat" / f"{map_id}.json").read_text(encoding="utf-8"))
    bins = h["bins"]
    want = defaultdict(Counter)  # (day, layer) -> cell -> count
    for r in clean:
        if r[2] != map_id:
            continue
        u, v = uv(map_id, r[3], r[5])
        col = min(bins - 1, max(0, int(u * bins)))
        row = min(bins - 1, max(0, int((1 - v) * bins)))
        for layer, evs in LAYERS.items():
            if r[7] in evs:
                want[(r[8], layer)][row * bins + col] += 1
    for day, layers in h["days"].items():
        for layer, cells in layers.items():
            got = Counter({i: c for i, c in cells})
            if got != want[(day, layer)]:
                diff = sum(abs(got[k] - want[(day, layer)][k]) for k in set(got) | set(want[(day, layer)]))
                fail(f"heat {map_id}/{day}/{layer}: {diff} counts differ")
print("checked heat grids")

# ---- 5. Map config copied correctly from README
for m, (s, ox, oz) in MAPS.items():
    c = index["maps"][m]
    if (c["scale"], c["ox"], c["oz"]) != (s, ox, oz):
        fail(f"map config {m} differs from README")

# ---- 6. README worked example
s, ox, oz = MAPS["AmbroseValley"]
u, v = (-301.45 - ox) / s, (-355.55 - oz) / s
if (round(u * 1024), round((1 - v) * 1024)) != (78, 890):
    fail("README example does not give (78, 890)")

print(f"\n{'PASS' if not problems else 'FAIL'}: {len(problems)} problems")
sys.exit(1 if problems else 0)
