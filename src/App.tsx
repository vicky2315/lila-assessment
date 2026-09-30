import { useCallback, useEffect, useMemo, useState } from 'react'
import Legend from './components/Legend'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'
import { loadHeat, loadIndex, loadMatch, minimapUrl } from './data'
import { EVENT_ORDER } from './lib/events'
import { MATCH_HEAT_BINS, heatToCanvas, matchHeat, sumHeat } from './lib/heat'
import { useHashState } from './lib/useHashState'
import type { DataIndex, EventType, HeatFile, HeatLayer, HeatScope, MapId, MatchDetail } from './types'

type HashKey = 'map' | 'days' | 'match' | 'layer' | 'heat'

const DEFAULT_MAP: MapId = 'AmbroseValley'

export default function App() {
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIndex().then(setIndex).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="status">Failed to load data: {error}</p>
  if (!index) return <p className="status">Loading…</p>
  return <Explorer index={index} />
}

function Explorer({ index }: { index: DataIndex }) {
  // Shareable state lives in the URL hash
  const [hash, setHash] = useHashState<HashKey>()
  const map: MapId = hash.map && hash.map in index.maps ? (hash.map as MapId) : DEFAULT_MAP
  const days = useMemo(() => (hash.days ? hash.days.split(',').filter((d) => index.days.includes(d)) : index.days), [hash.days, index.days])
  const layer: HeatLayer | 'none' = (hash.layer as HeatLayer | 'none') ?? 'traffic'
  const matchId = hash.match ?? null

  // Local view state
  const [showHumans, setShowHumans] = useState(true)
  const [showBots, setShowBots] = useState(true)
  const [visibleEvents, setVisibleEvents] = useState<Set<EventType>>(() => new Set(EVENT_ORDER))
  const [heatOpacity, setHeatOpacity] = useState(0.7)

  // Selected match + playback
  const [match, setMatch] = useState<MatchDetail | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(10)

  useEffect(() => {
    setPlaying(false)
    setMatchError(null)
    if (!matchId) {
      setMatch(null)
      return
    }
    let cancelled = false
    loadMatch(matchId)
      .then((m) => {
        if (cancelled) return
        setMatch(m)
        setTime(m.dur) // open showing the whole match; Play restarts from 0
        if (m.map !== map) setHash({ map: m.map }) // a shared link's match decides the map
      })
      .catch((e: Error) => !cancelled && setMatchError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  // Playback loop
  useEffect(() => {
    if (!playing || !match) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTime((t) => {
        const next = Math.min(match.dur, t + dt * speed)
        if (next >= match.dur) setPlaying(false)
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, match, speed])

  const playPause = useCallback(() => {
    if (!match) return
    if (!playing && time >= match.dur) setTime(0)
    setPlaying((p) => !p)
  }, [match, playing, time])

  // Space bar toggles playback (unless typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        playPause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playPause])

  // Heatmap: aggregate over every match on this map for the selected days
  const [heatFile, setHeatFile] = useState<HeatFile | null>(null)
  useEffect(() => {
    setHeatFile(null)
    let cancelled = false
    loadHeat(map).then((h) => !cancelled && setHeatFile(h))
    return () => {
      cancelled = true
    }
  }, [map])

  // With a match selected, heat defaults to that match only; "all" shows every match on the selected days
  const heatScope: HeatScope = match && hash.heat !== 'all' ? 'match' : 'all'

  const aggregateHeat = useMemo(() => {
    if (!heatFile || layer === 'none' || heatScope !== 'all') return null
    const { grid, total } = sumHeat(heatFile, days, layer)
    return { canvas: total ? heatToCanvas(grid, heatFile.bins) : null, total }
  }, [heatFile, days, layer, heatScope])

  const perMatchHeat = useMemo(() => {
    if (!match || layer === 'none' || heatScope !== 'match') return null
    const { grid, total } = matchHeat(match, layer, time, showHumans, showBots)
    return { canvas: total ? heatToCanvas(grid, MATCH_HEAT_BINS) : null, total }
  }, [match, layer, heatScope, time, showHumans, showBots])

  const heat = aggregateHeat ?? perMatchHeat ?? { canvas: null, total: 0 }

  const selectMatch = (id: string | null) => setHash({ match: id })
  const selectMap = (m: MapId) => setHash({ map: m, match: null })
  const selectDays = (d: string[]) => setHash({ days: d.length === index.days.length ? null : d.join(',') })
  const selectLayer = (l: HeatLayer | 'none') => setHash({ layer: l === 'traffic' ? null : l })

  const toggleEvent = (e: EventType) =>
    setVisibleEvents((prev) => {
      const next = new Set(prev)
      if (next.has(e)) next.delete(e)
      else next.add(e)
      return next
    })

  return (
    <div className="app">
      <Sidebar
        index={index}
        map={map}
        days={days}
        matchId={matchId}
        layer={layer}
        heatOpacity={heatOpacity}
        heatTotal={heat.total}
        heatScope={heatScope}
        hasMatch={!!match}
        onHeatScope={(s) => setHash({ heat: s === 'all' ? 'all' : null })}
        onMap={selectMap}
        onDays={selectDays}
        onMatch={selectMatch}
        onLayer={selectLayer}
        onHeatOpacity={setHeatOpacity}
      />
      <main>
        <MapView
          cfg={index.maps[map]}
          imageUrl={minimapUrl(map)}
          match={match && match.map === map ? match : null}
          time={time}
          heat={heat.canvas}
          heatOpacity={heatOpacity}
          showHumans={showHumans}
          showBots={showBots}
          visibleEvents={visibleEvents}
        />
        <Legend
          match={match}
          showHumans={showHumans}
          showBots={showBots}
          visibleEvents={visibleEvents}
          onToggleHumans={() => setShowHumans((v) => !v)}
          onToggleBots={() => setShowBots((v) => !v)}
          onToggleEvent={toggleEvent}
        />
        {!matchId && (
          <div className="hint">Pick a match on the left to see player paths and replay it. With no match picked, the heatmap covers every match on the selected days.</div>
        )}
        {matchError && <div className="hint error">Could not load match: {matchError}</div>}
        {match && (
          <Timeline
            match={match}
            time={time}
            playing={playing}
            speed={speed}
            onTime={(t) => {
              setPlaying(false)
              setTime(t)
            }}
            onPlayPause={playPause}
            onSpeed={setSpeed}
          />
        )}
      </main>
    </div>
  )
}
