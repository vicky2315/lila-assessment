# Insights

Three things I found while using the tool. Each one gives all information that was asked in the assessment document.

All numbers come from the 796 matches in the dataset (Feb 10 to 14, 2026). "Deaths" means deaths of human players unless stated otherwise.

---

## 1. Most of this data looks like test matches, not real games

Almost every match in the list says "1 human". Opening them, there is only ever one path on the map. The bots that player fought only show up as kill markers, never as paths of their own.

**Evidence.**

| Files recorded for the match | Matches |
|---|---|
| 1 human, no bot files | 743 (93%) |
| 1 human + 4 to 15 bot files | 36 |
| Bot files only, no human | 16 |
| 2 humans | 1 |

![Matches by players recorded, and what killed human players](docs/img/insight-test-data.svg)

The deaths point the same way. Out of 442 human deaths, 400 (90%) were caused by bots and 39 by the storm. Only **3** were caused by another human. Across all matches, humans killed 2,232 bots and only 3 humans.

A real extraction shooter with many players would have far more player-vs-player kills. One human playing against bots, again and again, looks a lot like test runs or smoke tests.

**Is it actionable?**
- Check with the data team which sessions were internal tests, and tag them in the telemetry.
- Until then, treat any balance conclusion from this dataset with care. It mostly shows how one player does against bots.
- Metrics affected: share of matches with more than one human, share of deaths caused by humans.

**Why a level designer should care.** This can be used for players who are basically new to the game and genre and can be seen as what their playthrough looks like. Smaller playthroughs would mean the game is tough for them.

---

## 2. Two classic fight zones: Mine Pit (GrandRift) and the river (Ambrose Valley)

On GrandRift, the kills heatmap lights up right on Mine Pit, the red zone in the middle of the map. On Ambrose Valley, the deaths heatmap follows the river that cuts through the centre.

![GrandRift kills heatmap](docs/img/grandrift-kills.jpg)

**Evidence: Mine Pit.** It is a small part of the map, but:

| | Share inside Mine Pit |
|---|---|
| Player movement | 17% |
| Loot | 21% |
| Kills | 27% |
| Deaths | 47% (14 of 30) |

It works like Pochinki on PUBG's Erangel: a central spot with good loot that pulls players in, so most of the fighting happens there.

![Ambrose Valley deaths heatmap](docs/img/ambrose-deaths.jpg)

**Evidence: Ambrose Valley river.** Within about 44 m of the river:

| | Share near the river |
|---|---|
| Player movement | 17% |
| Kills | 23% |
| Deaths | 28% |

Players die there more often than you would expect from how much time they spend there. It is like the bridges on Erangel: everyone has to cross, few routes lead over, and that makes them easy places to be caught.

![Share of movement, kills and deaths in each fight zone](docs/img/insight-fight-zones.svg)

**Is it actionable?**
- Mine Pit: if a high-risk, high-reward centre is the goal, it is working. If not, spread some loot to the quarters or add more cover on the way in.
- River: check cover at the crossings and whether there are enough ways across.
- Metrics affected: share of deaths per zone, deaths near the river compared with time spent there.

**Why a level designer should care.** These are the places that shape how a match plays out. We can try different iterations of loot distribution and maybe some environment changes that cater to snipers or short range weapons like close quarters can be tested here. 

---

## 3. Players who die were picking up less loot

Opening matches where the player died, their loot markers were sparse compared with matches where the player survived.

Below is a table for loot per minute alive, for players who lasted at least one minute:

| Map | Died | Survived |
|---|---|---|
| Ambrose Valley | 2.1 | 3.0 |
| Lockdown | 1.4 | 2.0 |
| GrandRift | 1.7 | 2.7 |

![Loot per minute, died vs survived, per map](docs/img/insight-loot-pace.svg)

It is per minute, so it is not just that survivors played longer. On every map, survivors looted 40% to 60% faster. This shows the two go together, not that one causes the other.

**Is it actionable?**
- Look at how much loot sits near spawn points and along the first routes players take.
- Metrics affected: loot picked up in the first two minutes, early death rate.

**Why a level designer should care.** If players who start slow on loot are the ones who die, I think the loot placement works exactly as intended, you do need loot to survive longer, unless you have a very stealthy playstyle and have a good strategy of killing someone with more loot when the storm closes in.
