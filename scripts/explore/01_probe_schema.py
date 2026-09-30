# Probe 1: schema, event counts, human vs bot split, map bounds, durations, duplicates. See docs/DATA_PIPELINE.md section 2.
import os, pyarrow.parquet as pq, pandas as pd
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
R="../player_data"  # run from repo root
for f in os.listdir(R+"/minimaps"): print(f, Image.open(R+"/minimaps/"+f).size)
frames=[];bad=[]
for d in sorted(os.listdir(R)):
    p=os.path.join(R,d)
    if not os.path.isdir(p) or d=="minimaps": continue
    for f in os.listdir(p):
        try:
            t=pq.read_table(os.path.join(p,f)).to_pandas(); t["day"]=d; t["file"]=f; frames.append(t)
        except Exception as e: bad.append((d,f,str(e)[:60]))
df=pd.concat(frames,ignore_index=True)
print("bad files",len(bad),bad[:3])
print(df.dtypes); print("rows",len(df))
df["event"]=df["event"].apply(lambda b:b.decode() if isinstance(b,bytes) else b)
print(df.event.value_counts())
df["bot"]=df.user_id.str.fullmatch(r"\d+")
print(pd.crosstab(df.event,df.bot))
print("maps per match max", df.groupby("match_id").map_id.nunique().max())
print(df.groupby("map_id").match_id.nunique())
print("matches spanning days", (df.groupby("match_id").day.nunique()>1).sum())
print("ts range", df.ts.min(), df.ts.max())
g=df.groupby("match_id").ts.agg(["min","max"]); d=(g["max"]-g["min"]).dt.total_seconds()
print("match dur s", d.describe())
for m,(s,ox,oz) in {"AmbroseValley":(900,-370,-473),"GrandRift":(581,-290,-290),"Lockdown":(1000,-500,-500)}.items():
    s_=df[df.map_id==m]; u=(s_.x-ox)/s; v=(s_.z-oz)/s
    print(m, "u",round(u.min(),3),round(u.max(),3),"v",round(v.min(),3),round(v.max(),3),"out%",round(((u<0)|(u>1)|(v<0)|(v>1)).mean()*100,2))
print("humans per match", df[~df.bot].groupby("match_id").user_id.nunique().describe())
print("bots per match", df[df.bot].groupby("match_id").user_id.nunique().describe())
print("nulls", df.isna().sum().to_dict())
print("dup rows", df.duplicated(subset=["user_id","match_id","ts","event","x","z"]).sum())
print("pos sample interval", df[df.event=="Position"].sort_values("ts").groupby("file").ts.diff().dt.total_seconds().describe())
