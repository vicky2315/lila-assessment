import { useMemo, useState } from 'react'
import { HEAT_LAYERS } from '../lib/events'
import { dayLabel, mmss, utcDateTime } from '../lib/format'
import type { DataIndex, HeatLayer, HeatScope, MapId, MatchSummary } from '../types'

type SortKey = 'time' | 'duration' | 'kills' | 'bots'

interface Props {
  index: DataIndex
  map: MapId
  days: string[]
  matchId: string | null
  layer: HeatLayer | 'none'
  heatOpacity: number
  heatIntensity: number
  heatTotal: number
  heatScope: HeatScope
  hasMatch: boolean
  onHeatScope: (s: HeatScope) => void
  onMap: (m: MapId) => void
  onDays: (d: string[]) => void
  onMatch: (id: string | null) => void
  onLayer: (l: HeatLayer | 'none') => void
  onHeatOpacity: (o: number) => void
  onHeatIntensity: (k: number) => void
  onReset: () => void
}

const kills = (m: MatchSummary) => (m.n.Kill ?? 0) + (m.n.BotKill ?? 0)

const SORTERS: Record<SortKey, (a: MatchSummary, b: MatchSummary) => number> = {
  time: (a, b) => a.start - b.start,
  duration: (a, b) => b.dur - a.dur,
  kills: (a, b) => kills(b) - kills(a),
  bots: (a, b) => b.bots - a.bots,
}

// Stated in the dataset README
const PARTIAL_DAY = 'February_14'

// Most matches have one human and no bot files: bots they fought appear only as BotKill/BotKilled events.

export default function Sidebar(props: Props) {
  const { index, map, days, matchId, layer, heatOpacity, heatIntensity, heatTotal, heatScope, hasMatch } = props
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('time')

  const mapCounts = useMemo(() => {
    const c = {} as Record<MapId, number>
    for (const m of index.matches) if (days.includes(m.day)) c[m.map] = (c[m.map] ?? 0) + 1
    return c
  }, [index, days])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return index.matches
      .filter((m) => m.map === map && days.includes(m.day) && (!q || m.id.startsWith(q)))
      .sort(SORTERS[sort])
  }, [index, map, days, search, sort])

  const toggleDay = (d: string) => props.onDays(days.includes(d) ? days.filter((x) => x !== d) : index.days.filter((x) => x === d || days.includes(x)))

  return (
    <aside className="sidebar">
      <section>
        <h2>
          Map
          <button className="link" onClick={props.onReset} title="Back to the default view">Reset view</button>
        </h2>
        <div className="seg">
          {(Object.keys(index.maps) as MapId[]).map((m) => (
            <button key={m} className={m === map ? 'active' : ''} onClick={() => props.onMap(m)}>
              {m.replace(/([a-z])([A-Z])/g, '$1 $2')}
              <span className="sub">{mapCounts[m] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>
          Days
          <button className="link" onClick={() => props.onDays(index.days)}>All</button>
        </h2>
        <div className="chips">
          {index.days.map((d) => (
            <button key={d} className={days.includes(d) ? 'chip active' : 'chip'} onClick={() => toggleDay(d)}>
              {dayLabel(d)}
            </button>
          ))}
        </div>
        {index.days.includes(PARTIAL_DAY) && <p className="note">{dayLabel(PARTIAL_DAY)} is a partial day (data collection was still running).</p>}
      </section>

      <section>
        <h2>Heatmap</h2>
        <div className="seg wrap">
          <button className={layer === 'none' ? 'active' : ''} onClick={() => props.onLayer('none')}>Off</button>
          {HEAT_LAYERS.map((l) => (
            <button key={l.id} className={layer === l.id ? 'active' : ''} onClick={() => props.onLayer(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        {layer !== 'none' && (
          <>
            {hasMatch && (
              <div className="seg scope" role="group" aria-label="Heatmap source">
                <button className={heatScope === 'match' ? 'active' : ''} onClick={() => props.onHeatScope('match')}>This match</button>
                <button className={heatScope === 'all' ? 'active' : ''} onClick={() => props.onHeatScope('all')}>All matches</button>
              </div>
            )}
            <label className="slider">
              Opacity
              <input type="range" min={0.1} max={1} step={0.05} value={heatOpacity} onChange={(e) => props.onHeatOpacity(Number(e.target.value))} />
            </label>
            <label className="slider" title="Boosts faint areas. Useful for layers with few events.">
              Intensity {heatIntensity}×
              <input type="range" min={1} max={5} step={0.5} value={heatIntensity} onChange={(e) => props.onHeatIntensity(Number(e.target.value))} />
            </label>
            <p className="note">
              {heatTotal.toLocaleString()} {HEAT_LAYERS.find((l) => l.id === layer)!.label.toLowerCase()} events{' '}
              {heatScope === 'match'
                ? 'in this match so far. Builds up as the match plays.'
                : `across all ${mapCounts[map] ?? 0} matches on the selected days.`}
            </p>
          </>
        )}
      </section>

      <section className="matches">
        <h2>
          Matches <span className="sub">{matches.length}</span>
          {matchId && <button className="link" onClick={() => props.onMatch(null)}>Clear</button>}
        </h2>
        <div className="match-tools">
          <input type="search" placeholder="Search match ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort matches">
            <option value="time">Oldest first</option>
            <option value="duration">Longest</option>
            <option value="kills">Most kills</option>
            <option value="bots">Most bots</option>
          </select>
        </div>
        {days.length === 0 && <p className="note">Select at least one day.</p>}
        <ul className="match-list">
          {matches.map((m) => (
            <li key={m.id}>
              <button className={m.id === matchId ? 'match active' : 'match'} onClick={() => props.onMatch(m.id === matchId ? null : m.id)}>
                <span className="m-top">
                  <span>{utcDateTime(m.start)}</span>
                  <span>{mmss(m.dur)}</span>
                </span>
                <span className="m-bottom">
                  <span>
                    {m.humans} {m.humans === 1 ? 'human' : 'humans'}
                    {m.bots > 0 && ` · ${m.bots} bots`}
                  </span>
                  <span>{kills(m)} kills</span>
                  {m.n.KilledByStorm ? <span className="storm">storm death</span> : null}
                  {(m.n.Killed ?? 0) + (m.n.BotKilled ?? 0) > 0 ? <span className="died">died</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
