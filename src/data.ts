import type { DataIndex, HeatFile, MapId, MatchDetail } from './types'

// BASE_URL comes from 'base' in vite.config.ts ('/lila-assessment/'), so paths work under the Pages sub-path
const base = import.meta.env.BASE_URL

export const minimapUrl = (map: MapId) => `${base}minimaps/${map}.webp`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const loadIndex = () => getJson<DataIndex>('data/index.json')

// Cache promises so switching back to a match or map never refetches
const matchCache = new Map<string, Promise<MatchDetail>>()
const heatCache = new Map<MapId, Promise<HeatFile>>()

export function loadMatch(id: string): Promise<MatchDetail> {
  let p = matchCache.get(id)
  if (!p) {
    p = getJson<MatchDetail>(`data/matches/${id}.json`)
    p.catch(() => matchCache.delete(id)) // allow retry after a failed fetch
    matchCache.set(id, p)
  }
  return p
}

export function loadHeat(map: MapId): Promise<HeatFile> {
  let p = heatCache.get(map)
  if (!p) {
    p = getJson<HeatFile>(`data/heat/${map}.json`)
    p.catch(() => heatCache.delete(map))
    heatCache.set(map, p)
  }
  return p
}
