import { EVENT_STYLE } from '../lib/events'
import { mmss } from '../lib/format'
import type { MatchDetail } from '../types'

interface Props {
  match: MatchDetail
  time: number
  playing: boolean
  speed: number
  onTime: (t: number) => void
  onPlayPause: () => void
  onSpeed: (s: number) => void
}

const SPEEDS = [1, 5, 10, 20]

export default function Timeline({ match, time, playing, speed, onTime, onPlayPause, onSpeed }: Props) {
  const dur = Math.max(1, match.dur)
  // Ticks for fights and deaths only; loot would clutter the bar
  const ticks = match.events.filter((e) => e[1] !== 'Loot')

  return (
    <div className="timeline">
      <button className="play" onClick={onPlayPause} title={playing ? 'Pause (space)' : 'Play (space)'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="clock">
        {mmss(time)} / {mmss(dur)}
      </span>
      <div className="scrub">
        <div className="ticks">
          {ticks.map((e, i) => (
            <span
              key={i}
              className="tick"
              style={{ left: `${(e[2] / dur) * 100}%`, background: EVENT_STYLE[e[1]].color }}
              title={`${EVENT_STYLE[e[1]].hint} at ${mmss(e[2])}`}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={dur}
          step={0.5}
          value={time}
          onChange={(e) => onTime(Number(e.target.value))}
          aria-label="Match time"
        />
      </div>
      <div className="speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'active' : ''} onClick={() => onSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
