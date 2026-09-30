# Probe 2: proves ts is unix seconds, event mix in bot vs human files, files per match. See docs/DATA_PIPELINE.md section 2.
import os, pyarrow.parquet as pq, pandas as pd
R="../player_data"  # run from repo root
fr=[]
for d in sorted(os.listdir(R)):
    p=os.path.join(R,d)
    if not os.path.isdir(p) or d=="minimaps": continue
    for f in os.listdir(p):
        t=pq.read_table(os.path.join(p,f)).to_pandas(); t["day"]=d; t["file"]=f; fr.append(t)
df=pd.concat(fr,ignore_index=True)
df["event"]=df.event.map(lambda b:b.decode())
df["bot"]=df.user_id.str.fullmatch(r"\d+")
df["sec"]=df.ts.astype("int64")  # ms-typed value == unix seconds
df["dt"]=pd.to_datetime(df.sec,unit="s",utc=True)
print("dt range",df.dt.min(),df.dt.max())
print(df.groupby("day").dt.agg(["min","max"]))
# files per bot uid: events mix
bf=df[df.bot].groupby("file").event.agg(lambda s:",".join(sorted(set(s))))
print(bf.value_counts().head(10))
hf=df[~df.bot].groupby("file").event.agg(lambda s:",".join(sorted(set(s))))
print(hf.value_counts().head(8))
print("files per match", df.groupby("match_id").file.nunique().value_counts().head(8))
print("filename uid==col uid", (df.file.str.split("_").str[0]==df.user_id).all(), "match in name",(df.file.str.split("_",n=1).str[1]==df.match_id).all())
print("user_id sample bots", df[df.bot].user_id.unique()[:10])
# deaths per file
dead=df[df.event.isin(["Killed","BotKilled","KilledByStorm"])].groupby("file").size()
print("death events per file", dead.value_counts())
print("rows per file", df.groupby("file").size().describe())
sp=df.groupby("match_id").day.nunique(); m=sp[sp>1].index; print(df[df.match_id.isin(m)].groupby(["day"]).dt.agg(["min","max"]))
print("y range", df.y.describe())
