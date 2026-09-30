// Shapes of the JSON written by scripts/preprocess.py

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'

export type EventType = 'Kill' | 'Killed' | 'BotKill' | 'BotKilled' | 'KilledByStorm' | 'Loot'

export type HeatLayer = 'traffic' | 'kills' | 'deaths' | 'storm' | 'loot'

/** Heatmap source: the selected match only, or every match on the selected days */
export type HeatScope = 'match' | 'all'

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
  n: Partial<Record<EventType, number>> // non-movement event counts
}

export interface DataIndex {
  maps: Record<MapId, MapConfig>
  days: string[]
  matches: MatchSummary[]
}

export interface PlayerTrack {
  id: string
  bot: boolean
  t: number[] // seconds since match start
  u: number[] // 0..1 across the map
  v: number[] // 0..1 up the map (flipped when drawn)
}

/** [playerIndex, type, t, u, v] */
export type MatchEvent = [number, EventType, number, number, number]

export interface MatchDetail {
  id: string
  map: MapId
  start: number
  dur: number
  players: PlayerTrack[]
  events: MatchEvent[]
}

export interface HeatFile {
  bins: number
  /** day -> layer -> sparse [cellIndex, count], cellIndex = row * bins + col, row 0 = top of image */
  days: Record<string, Record<HeatLayer, [number, number][]>>
}
