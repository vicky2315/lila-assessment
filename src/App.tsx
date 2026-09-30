import { useEffect, useState } from 'react'
import { loadIndex, minimapUrl } from './data'
import type { DataIndex, MapId } from './types'

// Skeleton: proves data + minimaps load on the deployed site. Real UI comes next.
export default function App() {
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [map, setMap] = useState<MapId>('AmbroseValley')

  useEffect(() => {
    loadIndex().then(setIndex).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="status">Failed to load data: {error}</p>
  if (!index) return <p className="status">Loading…</p>

  const maps = Object.keys(index.maps) as MapId[]
  const count = index.matches.filter((m) => m.map === map).length

  return (
    <div className="app">
      <header>
        <h1>LILA BLACK · Player Journeys</h1>
        <select value={map} onChange={(e) => setMap(e.target.value as MapId)}>
          {maps.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span>{count} matches · {index.days.length} days</span>
      </header>
      <img className="minimap" src={minimapUrl(map)} alt={`${map} minimap`} />
    </div>
  )
}
