# Draw every path and kill on each minimap to check coordinate mapping by eye. Output: scripts/explore/out/
import json,glob
from PIL import Image,ImageDraw
idx=json.load(open("public/data/index.json"))
S="scripts/explore/out"; import os; os.makedirs(S, exist_ok=True)
for mp in idx["maps"]:
    im=Image.open(f"public/minimaps/{mp}.webp").convert("RGB"); W,H=im.size; d=ImageDraw.Draw(im)
    for x in idx["matches"]:
        if x["map"]!=mp: continue
        md=json.load(open(f"public/data/matches/{x['id']}.json"))
        for p in md["players"]:
            pts=[(u*W,(1-v)*H) for u,v in zip(p["u"],p["v"])]
            if len(pts)>1: d.line(pts,fill=(255,60,60) if not p["bot"] else (60,160,255),width=2)
        for e in md["events"]:
            if e[1] in("BotKill","Kill"): d.ellipse([e[3]*W-5,(1-e[4])*H-5,e[3]*W+5,(1-e[4])*H+5],fill=(255,255,0))
    im.resize((1024,int(1024*H/W))).save(f"{S}/overlay_{mp}.png")
