import type { EventType, HeatLayer } from '../types'

export type MarkerShape = 'x' | 'square' | 'triangle' | 'diamond'

export interface EventStyle {
  label: string
  hint: string
  color: string
  shape: MarkerShape
}

// Shape says what happened (x = kill, square = death, triangle = storm, diamond = loot).
// Color says who was involved (red = vs human, orange = vs bot).
export const EVENT_STYLE: Record<EventType, EventStyle> = {
  Kill: { label: 'Kill (human)', hint: 'Human killed a human', color: '#ff4d4d', shape: 'x' },
  BotKill: { label: 'Kill (bot)', hint: 'Killed a bot', color: '#ffa31a', shape: 'x' },
  Killed: { label: 'Death (by human)', hint: 'Killed by a human', color: '#ff4d4d', shape: 'square' },
  BotKilled: { label: 'Death (by bot)', hint: 'Killed by a bot', color: '#ffa31a', shape: 'square' },
  KilledByStorm: { label: 'Storm death', hint: 'Died to the storm', color: '#c77dff', shape: 'triangle' },
  Loot: { label: 'Loot', hint: 'Picked up an item', color: '#ffe066', shape: 'diamond' },
}

/**
 * The README defines these events from the human's side only. Bot files contain them too,
 * and their meaning there is not documented (a BotKilled in a bot's file may mean a bot was
 * killed by another bot). So for bot-owned events we show the raw event name, not a guess.
 */
export function eventHint(type: EventType, ownerIsBot: boolean): string {
  // Raw event name always; the README meaning only where the README defines it (human files)
  return ownerIsBot ? `${type} (in bot's file)` : `${type}: ${EVENT_STYLE[type].hint.toLowerCase()}`
}

export const EVENT_ORDER: EventType[] = ['Kill', 'BotKill', 'Killed', 'BotKilled', 'KilledByStorm', 'Loot']

export const PATH_STYLE = {
  human: { color: '#4cc9f0', width: 2.25 },
  bot: { color: '#c0c4cc', width: 1.25, dash: [6, 5] },
}

export const HEAT_LAYERS: { id: HeatLayer; label: string }[] = [
  { id: 'traffic', label: 'Traffic' },
  { id: 'kills', label: 'Kills' },
  { id: 'deaths', label: 'Deaths' },
  { id: 'storm', label: 'Storm deaths' },
  { id: 'loot', label: 'Loot' },
]
