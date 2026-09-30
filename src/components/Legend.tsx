import { EVENT_ORDER, EVENT_STYLE, PATH_STYLE, type MarkerShape } from '../lib/events'
import type { EventType, MatchDetail } from '../types'

interface Props {
  match: MatchDetail | null
  showHumans: boolean
  showBots: boolean
  visibleEvents: Set<EventType>
  onToggleHumans: () => void
  onToggleBots: () => void
  onToggleEvent: (e: EventType) => void
}

/** Legend that doubles as the layer toggles. Counts are for the selected match. */
export default function Legend({ match, showHumans, showBots, visibleEvents, onToggleHumans, onToggleBots, onToggleEvent }: Props) {
  const counts = new Map<EventType, number>()
  let humans = 0
  let bots = 0
  if (match) {
    for (const e of match.events) counts.set(e[1], (counts.get(e[1]) ?? 0) + 1)
    for (const p of match.players) p.bot ? bots++ : humans++
  }

  return (
    <div className="legend">
      <div className="legend-title">Players</div>
      <label className="legend-row">
        <input type="checkbox" checked={showHumans} onChange={onToggleHumans} />
        <svg width="28" height="10"><line x1="1" y1="5" x2="27" y2="5" stroke={PATH_STYLE.human.color} strokeWidth="2.5" /></svg>
        Human{match && <span className="count">{humans}</span>}
      </label>
      <label className="legend-row">
        <input type="checkbox" checked={showBots} onChange={onToggleBots} />
        <svg width="28" height="10"><line x1="1" y1="5" x2="27" y2="5" stroke={PATH_STYLE.bot.color} strokeWidth="1.5" strokeDasharray="5 4" /></svg>
        Bot{match && <span className="count">{bots}</span>}
      </label>

      <div className="legend-title">Events</div>
      {EVENT_ORDER.map((type) => (
        <label key={type} className="legend-row" title={EVENT_STYLE[type].hint}>
          <input type="checkbox" checked={visibleEvents.has(type)} onChange={() => onToggleEvent(type)} />
          <MarkerIcon shape={EVENT_STYLE[type].shape} color={EVENT_STYLE[type].color} />
          {EVENT_STYLE[type].label}
          {match && <span className="count">{counts.get(type) ?? 0}</span>}
        </label>
      ))}
    </div>
  )
}

function MarkerIcon({ shape, color }: { shape: MarkerShape; color: string }) {
  const stroke = '#0b0d12'
  return (
    <svg width="28" height="14" viewBox="-14 -7 28 14">
      {shape === 'x' && (
        <g strokeLinecap="round">
          <path d="M-4,-4 L4,4 M4,-4 L-4,4" stroke={stroke} strokeWidth="4.5" />
          <path d="M-4,-4 L4,4 M4,-4 L-4,4" stroke={color} strokeWidth="2.5" />
        </g>
      )}
      {shape === 'square' && <rect x="-4" y="-4" width="8" height="8" fill={color} stroke={stroke} />}
      {shape === 'triangle' && <path d="M0,-5 L5,4 L-5,4 Z" fill={color} stroke={stroke} />}
      {shape === 'diamond' && <path d="M0,-4 L4,0 L0,4 L-4,0 Z" fill={color} stroke={stroke} />}
    </svg>
  )
}
