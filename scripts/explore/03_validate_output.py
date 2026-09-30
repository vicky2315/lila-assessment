# Validate preprocess output: counts, heat totals, README example point (expect 78 890). Run after preprocess.py.
import json,glob,os
idx=json.load(open("public/data/index.json"))
print("maps",json.dumps(idx["maps"]))
print("days",idx["days"])
m=idx["matches"]; print("matches",len(m))
print("sample index row",json.dumps(m[0]))
from collections import Counter
print("per map",Counter(x["map"] for x in m)); print("per day",Counter(x["day"] for x in m))
d=[x["dur"] for x in m]; print("dur s min/median/max",min(d),sorted(d)[len(d)//2],max(d))
tot=Counter()
for x in m: tot.update(x["n"])
print("event totals",dict(tot))
# README example
c=idx["maps"]["AmbroseValley"]; u=(-301.45-c["ox"])/c["scale"]; v=(-355.55-c["oz"])/c["scale"]
print("README example px on 1024:",round(u*1024),round((1-v)*1024))
# heat totals vs events
ht=Counter()
for f in glob.glob("public/data/heat/*.json"):
    h=json.load(open(f))
    for day,L in h["days"].items():
        for k,cells in L.items(): ht[k]+=sum(c for _,c in cells)
print("heat totals",dict(ht))
# biggest match
big=max(m,key=lambda x:x["humans"]+x["bots"]); print("biggest match",json.dumps(big))
md=json.load(open(f"public/data/matches/{big['id']}.json"))
print("players",len(md["players"]),"events",len(md["events"]),"first player pts",len(md["players"][0]["t"]),"first events",md["events"][:3])
sz=sorted(os.path.getsize(f) for f in glob.glob("public/data/matches/*.json")); print("match file bytes min/median/max",sz[0],sz[len(sz)//2],sz[-1])
