"""Numbers and charts for INSIGHTS.md.

Reads the processed data in public/data (the same files the tool loads), prints every
number used in INSIGHTS.md and writes one SVG chart per insight to docs/img/.

Run from anywhere:  python scripts/insights/charts.py
"""

import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"
OUT = ROOT / "docs" / "img"

DEATHS = {"Killed", "BotKilled", "KilledByStorm"}
KILLS = {"Kill", "BotKill"}

# Outlines traced by hand from the minimaps, in minimap pixels (2048 px wide).
# Mine Pit: the red zone in the middle of GrandRift. River: centre line through Ambrose Valley.
MINE_PIT = [(x * 1.024, y * 1.024) for x, y in [
    (880, 870), (930, 815), (980, 815), (1000, 850), (1020, 1000), (1020, 1300),
    (840, 1290), (815, 1230), (815, 1110), (840, 1010), (905, 1000), (880, 930)]]
RIVER = [(x * 1.02, y * 1.02) for x, y in [
    (1115, 345), (1050, 480), (960, 620), (900, 700), (820, 780), (740, 860), (660, 960),
    (620, 1050), (600, 1150), (580, 1250), (540, 1300), (460, 1380), (380, 1440), (230, 1520)]]
RIVER_PX = 100  # "near the river" = within 100 minimap px (about 44 m on Ambrose Valley)


def load():
    index = json.loads((DATA / "index.json").read_text())
    matches = [json.loads((DATA / "matches" / f"{m['id']}.json").read_text()) for m in index["matches"]]
    return index, matches


def to_px(cfg, u, v):
    return u * cfg["w"], (1 - v) * cfg["h"]


def in_polygon(x, y, poly):
    inside = False
    for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            inside = not inside
    return inside


def dist_to_line(x, y, line):
    best = math.inf
    for (ax, ay), (bx, by) in zip(line, line[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(x - ax - t * dx, y - ay - t * dy))
    return best


def human_runs(match):
    """(player, own events, first death or None, seconds alive) for each human in the match."""
    for pi, p in enumerate(match["players"]):
        if p["bot"] or not p["t"]:
            continue
        mine = [e for e in match["events"] if e[0] == pi]
        death = next((e for e in mine if e[1] in DEATHS), None)
        yield p, mine, death, death[2] if death else p["t"][-1]


# ---------- numbers ----------

def recorded_players(index):
    groups = Counter()
    for m in index["matches"]:
        if m["humans"] == 1 and m["bots"] == 0:
            groups["1 human only"] += 1
        elif m["humans"] == 1:
            groups["1 human + bot files"] += 1
        elif m["humans"] == 0:
            groups["Bot files only"] += 1
        else:
            groups[f"{m['humans']} humans"] += 1
    return groups


def death_causes(matches):
    causes = Counter()
    for m in matches:
        for _, _, death, _ in human_runs(m):
            if death:
                causes[{"BotKilled": "Bots", "KilledByStorm": "Storm", "Killed": "Other humans"}[death[1]]] += 1
    return causes


def zone_shares(index, matches, map_id, is_in):
    cfg = index["maps"][map_id]
    counts = {k: [0, 0] for k in ("Movement", "Loot", "Kills", "Deaths")}
    for m in matches:
        if m["map"] != map_id:
            continue
        for p in m["players"]:
            for u, v in zip(p["u"], p["v"]):
                counts["Movement"][is_in(*to_px(cfg, u, v))] += 1
        for pi, ty, _, u, v in m["events"]:
            if m["players"][pi]["bot"]:
                continue
            inside = is_in(*to_px(cfg, u, v))
            if ty in KILLS:
                counts["Kills"][inside] += 1
            elif ty in DEATHS:
                counts["Deaths"][inside] += 1
            elif ty == "Loot":
                counts["Loot"][inside] += 1
    return {k: (n, o + n) for k, (o, n) in counts.items()}


def loot_pace(matches):
    """Mean loot per minute alive, died vs survived, for humans alive at least 60 s."""
    rates = defaultdict(lambda: {"Died": [], "Survived": []})
    for m in matches:
        for _, mine, death, alive in human_runs(m):
            if alive >= 60:
                loot = sum(e[1] == "Loot" for e in mine)
                rates[m["map"]]["Died" if death else "Survived"].append(loot / (alive / 60))
    return {k: {g: (mean(v), len(v)) for g, v in r.items()} for k, r in rates.items()}


# ---------- SVG ----------

STYLE = """<style>
  svg { --surface:#fcfcfb; --text:#0b0b0b; --text2:#52514e; --muted:#8a8984; --grid:#e4e3df;
        --s1:#2a78d6; --s2:#eb6834; --base:#b4b2ab; --died:#86b6ef; --survived:#1c5cab; }
  @media (prefers-color-scheme: dark) {
    svg { --surface:#1a1a19; --text:#ffffff; --text2:#c3c2b7; --muted:#8f8e86; --grid:#33332f;
          --s1:#3987e5; --s2:#d95926; --base:#6e6d68; --died:#2a78d6; --survived:#86b6ef; }
  }
  text { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: var(--text); }
  .title { font-size: 16px; font-weight: 600; }
  .sub { font-size: 12px; fill: var(--text2); }
  .label { font-size: 12px; fill: var(--text2); }
  .value { font-size: 12px; font-weight: 600; }
  .axis { font-size: 11px; fill: var(--muted); }
  .grid { stroke: var(--grid); stroke-width: 1; }
</style>"""


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img" aria-label="{title}">\n{STYLE}\n<title>{title}</title>\n'
            f'<rect width="{w}" height="{h}" rx="8" fill="var(--surface)"/>\n{body}\n</svg>\n')


def bar(x, y, w, h, fill, r=4):
    """Horizontal bar anchored at x, rounded only on its data end."""
    if w < 2 * r:
        return f'<rect x="{x}" y="{y}" width="{max(w, 2):.1f}" height="{h}" fill="var({fill})"/>'
    return (f'<path d="M{x},{y} h{w - r:.1f} a{r},{r} 0 0 1 {r},{r} v{h - 2 * r} '
            f'a{r},{r} 0 0 1 -{r},{r} h-{w - r:.1f} z" fill="var({fill})"/>')


def legend(x, y, items):
    out, cx = [], x
    for name, fill in items:
        out.append(f'<rect x="{cx}" y="{y - 9}" width="10" height="10" rx="2" fill="var({fill})"/>'
                   f'<text class="label" x="{cx + 15}" y="{y}">{name}</text>')
        cx += 30 + 7 * len(name)
    return "".join(out)


def bar_panel(y, heading, rows, label_w=150, plot_w=470, x0=24):
    """Single-series horizontal bar chart. rows = [(label, value)]."""
    top = max(v for _, v in rows)
    out = [f'<text class="value" x="{x0}" y="{y}">{heading}</text>']
    for i, (label, value) in enumerate(rows):
        by = y + 16 + i * 30
        w = plot_w * value / top
        out.append(f'<text class="label" x="{x0}" y="{by + 15}">{label}</text>')
        out.append(bar(x0 + label_w, by, w, 20, "--s1"))
        out.append(f'<text class="value" x="{x0 + label_w + max(w, 2) + 8}" y="{by + 15}">{value:,}</text>')
    return "".join(out), y + 16 + len(rows) * 30


def chart_test_data(groups, causes):
    order = ["1 human only", "1 human + bot files", "Bot files only"]
    rows_a = [(k, groups[k]) for k in order] + [(k, v) for k, v in groups.items() if k not in order]
    rows_b = [(k, causes[k]) for k in ("Bots", "Storm", "Other humans")]
    title = "Most matches recorded one player, and bots caused almost every death"
    body = [f'<text class="title" x="24" y="34">{title}</text>',
            f'<text class="sub" x="24" y="54">All {sum(groups.values())} matches, Feb 10 to 14, 2026</text>']
    a, y = bar_panel(90, "Matches, by players recorded", rows_a)
    b, y = bar_panel(y + 30, f"What killed human players ({sum(causes.values())} deaths)", rows_b)
    body += [a, b]
    return svg(720, y + 16, "".join(body), title)


def chart_fight_zones(zones):
    measures = [("Movement", "--base"), ("Kills", "--s1"), ("Deaths", "--s2")]
    title = "Fight zones take a bigger share of kills and deaths than of movement"
    x0, label_w, plot_w, top = 24, 150, 440, 0.5
    body = [f'<text class="title" x="{x0}" y="34">{title}</text>',
            f'<text class="sub" x="{x0}" y="54">Share of each map\'s total that happens inside the zone</text>',
            legend(x0, 84, [(f"Share of {m.lower()}", f) for m, f in measures])]
    y = 110
    for name, shares in zones:
        body.append(f'<text class="value" x="{x0}" y="{y + 30}">{name[0]}</text>'
                    f'<text class="sub" x="{x0}" y="{y + 46}">{name[1]}</text>')
        for i, (m, fill) in enumerate(measures):
            n, total = shares[m]
            by = y + i * 24
            w = plot_w * (n / total) / top
            body.append(bar(x0 + label_w, by, w, 20, fill))
            body.append(f'<text class="value" x="{x0 + label_w + w + 8}" y="{by + 15}">{n / total:.0%}</text>')
            if m == "Deaths":
                body.append(f'<text class="axis" x="{x0 + label_w + w + 44}" y="{by + 15}">{n} of {total}</text>')
        y += 3 * 24 + 26
    # x axis
    for p in (0, 0.1, 0.2, 0.3, 0.4, 0.5):
        gx = x0 + label_w + plot_w * p / top
        body.insert(3, f'<line class="grid" x1="{gx}" x2="{gx}" y1="104" y2="{y - 20}"/>')
        body.append(f'<text class="axis" x="{gx}" y="{y - 4}" text-anchor="middle">{p:.0%}</text>')
    return svg(720, y + 12, "".join(body), title)


def chart_loot_pace(pace):
    maps = [("AmbroseValley", "Ambrose Valley"), ("Lockdown", "Lockdown"), ("GrandRift", "GrandRift")]
    title = "Players who died were picking up less loot per minute"
    x0, label_w, plot_w, top = 24, 150, 470, 3.5
    sx = lambda v: x0 + label_w + plot_w * v / top
    body = [f'<text class="title" x="{x0}" y="34">{title}</text>',
            f'<text class="sub" x="{x0}" y="54">Mean loot items per minute alive, human players alive at least 1 minute</text>',
            legend(x0, 84, [("Died", "--died"), ("Survived", "--survived")])]
    y = 116
    for key, name in maps:
        d, s = pace[key]["Died"][0], pace[key]["Survived"][0]
        n = pace[key]["Died"][1] + pace[key]["Survived"][1]
        body.append(f'<text class="label" x="{x0}" y="{y + 5}">{name}</text>'
                    f'<text class="axis" x="{x0}" y="{y + 20}">{n} players</text>')
        body.append(f'<line x1="{sx(d)}" x2="{sx(s)}" y1="{y}" y2="{y}" stroke="var(--base)" stroke-width="2"/>')
        for v, fill, anchor, dx in ((d, "--died", "end", -12), (s, "--survived", "start", 12)):
            body.append(f'<circle cx="{sx(v)}" cy="{y}" r="6" fill="var({fill})" stroke="var(--surface)" stroke-width="2"/>')
            body.append(f'<text class="value" x="{sx(v) + dx}" y="{y + 4}" text-anchor="{anchor}">{v:.1f}</text>')
        y += 48
    for t in range(0, 4):
        body.insert(3, f'<line class="grid" x1="{sx(t)}" x2="{sx(t)}" y1="100" y2="{y - 24}"/>')
        body.append(f'<text class="axis" x="{sx(t)}" y="{y - 8}" text-anchor="middle">{t}</text>')
    return svg(720, y + 8, "".join(body), title)


def main():
    index, matches = load()
    OUT.mkdir(parents=True, exist_ok=True)

    groups, causes = recorded_players(index), death_causes(matches)
    print("Players recorded per match:", dict(groups))
    print("What killed human players:", dict(causes))

    mine = zone_shares(index, matches, "GrandRift", lambda x, y: in_polygon(x, y, MINE_PIT))
    river = zone_shares(index, matches, "AmbroseValley", lambda x, y: dist_to_line(x, y, RIVER) < RIVER_PX)
    for name, z in (("Mine Pit", mine), ("Ambrose river", river)):
        print(name + ":", {k: f"{n}/{t} = {n / t:.0%}" for k, (n, t) in z.items()})

    pace = loot_pace(matches)
    for k, r in pace.items():
        print(f"Loot per minute {k}:", {g: f"{v:.2f} (n={n})" for g, (v, n) in r.items()})

    (OUT / "insight-test-data.svg").write_text(chart_test_data(groups, causes), encoding="utf-8")
    (OUT / "insight-fight-zones.svg").write_text(
        chart_fight_zones([(("Mine Pit", "GrandRift"), mine), (("River", "Ambrose Valley"), river)]), encoding="utf-8")
    (OUT / "insight-loot-pace.svg").write_text(chart_loot_pace(pace), encoding="utf-8")
    print("Charts written to", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
