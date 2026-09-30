// Shapes of the JSON written by scripts/preprocess.py

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'

export interface MapConfig {
  scale: number
  ox: number
  oz: number
  w: number // minimap image width (px) as served
  h: number
  origW: number
  origH: number
}

export interface MatchSummary {
  id: string
  map: MapId
  day: string
  start: number // unix seconds
  dur: number // seconds
  humans: number
  bots: number
  n: Partial<Record<string, number>> // non-movement event counts
}

export interface DataIndex {
  maps: Record<MapId, MapConfig>
  days: string[]
  matches: MatchSummary[]
}
