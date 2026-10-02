import { useCallback, useEffect, useMemo, useState } from 'react'
import Legend from './components/Legend'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'
import { loadHeat, loadIndex, loadMatch, minimapUrl } from './data'
import { EVENT_ORDER, HEAT_LAYERS } from './lib/events'
import { MATCH_HEAT_BINS, heatToCanvas, matchHeat, sumHeat } from './lib/heat'
import { useHashState } from './lib/useHashState'
import type { DataIndex, EventType, HeatFile, HeatLayer, HeatScope, MapId, MatchDetail } from './types'

type HashKey = 'map' | 'days' | 'match' | 'layer' | 'heat'

const DEFAULT_MAP: MapId = 'AmbroseValley'
const DEFAULT_OPACITY = 0.7
const DEFAULT_INTENSITY = 1
const DEFAULT_SPEED = 10
const NO_DAYS = 'none'
const LAYER_IDS: (HeatLayer | 'none')[] = ['none', ...HEAT_LAYERS.map((l) => l.id)]

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
  // No 'days' param = all days. 'none' is explicit so an empty selection survives the URL round trip.
  const days = useMemo(() => {
    if (!hash.days) return index.days
    if (hash.days === NO_DAYS) return []
    return hash.days.split(',').filter((d) => index.days.includes(d))
  }, [hash.days, index.days])
  // Validate URL values: a hand-edited link must never crash the app
  const layer: HeatLayer | 'none' = LAYER_IDS.includes(hash.layer as HeatLayer | 'none') ? (hash.layer as HeatLayer | 'none') : 'traffic'
  const matchId = hash.match ?? null

  // Local view state
  const [showHumans, setShowHumans] = useState(true)
  const [showBots, setShowBots] = useState(true)
  const [visibleEvents, setVisibleEvents] = useState<Set<EventType>>(() => new Set(EVENT_ORDER))
  // Bumped by Reset view: re-fits the map and remounts the sidebar (clears its search and sort)
  const [resetCount, setResetCount] = useState(0)
  const [heatOpacity, setHeatOpacity] = useState(DEFAULT_OPACITY)
  const [heatIntensity, setHeatIntensity] = useState(DEFAULT_INTENSITY)

  // Selected match + playback
  const [loadedMatch, setMatch] = useState<MatchDetail | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)

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

  // Only use the match if it belongs to the map on screen (a shared link switches map right after loading)
  const match = loadedMatch && loadedMatch.map === map ? loadedMatch : null

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
      if (e.code === 'Space' && match && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        playPause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playPause, match])

  // Heatmap: aggregate over every match on this map for the selected days
  const [heatFile, setHeatFile] = useState<HeatFile | null>(null)
  const [heatError, setHeatError] = useState<string | null>(null)
  useEffect(() => {
    setHeatFile(null)
    let cancelled = false
    setHeatError(null)
    loadHeat(map)
      .then((h) => !cancelled && setHeatFile(h))
      .catch((e: Error) => !cancelled && setHeatError(e.message))
    return () => {
      cancelled = true
    }
  }, [map])

  // With a match selected, heat defaults to that match only; "all" shows every match on the selected days
  const heatScope: HeatScope = match && hash.heat !== 'all' ? 'match' : 'all'

  const aggregateHeat = useMemo(() => {
    if (!heatFile || layer === 'none' || heatScope !== 'all') return null
    const { grid, total } = sumHeat(heatFile, days, layer)
    return { canvas: total ? heatToCanvas(grid, heatFile.bins, heatIntensity) : null, total }
  }, [heatFile, days, layer, heatScope, heatIntensity])

  const perMatchHeat = useMemo(() => {
    if (!match || layer === 'none' || heatScope !== 'match') return null
    const { grid, total } = matchHeat(match, layer, time, showHumans, showBots)
    return { canvas: total ? heatToCanvas(grid, MATCH_HEAT_BINS, heatIntensity) : null, total }
  }, [match, layer, heatScope, time, showHumans, showBots, heatIntensity])

  const heat = aggregateHeat ?? perMatchHeat ?? { canvas: null, total: 0 }

  const selectMatch = (id: string | null) => setHash({ match: id })
  const selectMap = (m: MapId) => setHash({ map: m, match: null })
  const selectDays = (d: string[]) => setHash({ days: d.length === index.days.length ? null : d.length ? d.join(',') : NO_DAYS })
  const selectLayer = (l: HeatLayer | 'none') => setHash({ layer: l === 'traffic' ? null : l })

  // Back to the default view: clears the URL state and every local setting
  const resetView = () => {
    setHash({ map: null, days: null, match: null, layer: null, heat: null })
    setShowHumans(true)
    setShowBots(true)
    setVisibleEvents(new Set(EVENT_ORDER))
    setHeatOpacity(DEFAULT_OPACITY)
    setHeatIntensity(DEFAULT_INTENSITY)
    setSpeed(DEFAULT_SPEED)
    setPlaying(false)
    setResetCount((n) => n + 1)
  }

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
        key={resetCount}
        index={index}
        map={map}
        days={days}
        matchId={matchId}
        layer={layer}
        heatOpacity={heatOpacity}
        heatIntensity={heatIntensity}
        heatTotal={heat.total}
        heatScope={heatScope}
        hasMatch={!!match}
        onHeatScope={(s) => setHash({ heat: s === 'all' ? 'all' : null })}
        onMap={selectMap}
        onDays={selectDays}
        onMatch={selectMatch}
        onLayer={selectLayer}
        onHeatOpacity={setHeatOpacity}
        onHeatIntensity={setHeatIntensity}
        onReset={resetView}
        showHumans={showHumans}
        showBots={showBots}
      />
      <main>
        <MapView
          cfg={index.maps[map]}
          imageUrl={minimapUrl(map)}
          match={match}
          time={time}
          heat={heat.canvas}
          heatOpacity={heatOpacity}
          showHumans={showHumans}
          showBots={showBots}
          visibleEvents={visibleEvents}
          fitKey={resetCount}
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
        {heatError && layer !== 'none' && <div className="hint error">Could not load heatmap: {heatError}</div>}
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
