import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENT_STYLE, PATH_STYLE, eventHint, type MarkerShape } from '../lib/events'
import { mmss, shortId } from '../lib/format'
import type { EventType, MapConfig, MatchDetail, MatchEvent, PlayerTrack } from '../types'

interface Props {
  cfg: MapConfig
  imageUrl: string
  match: MatchDetail | null
  time: number // playback position, seconds since match start
  heat: HTMLCanvasElement | null
  heatOpacity: number
  showHumans: boolean
  showBots: boolean
  visibleEvents: Set<EventType>
}

/** Screen transform: screen = image * scale + (tx, ty). All drawing happens in image pixel space. */
interface View {
  scale: number
  tx: number
  ty: number
}

interface Hit {
  x: number // css px, relative to canvas
  y: number
  ev: MatchEvent
  player: PlayerTrack
}

const MARKER_PX = 7
const HIT_RADIUS_PX = 10
const MIN_ZOOM = 0.5 // relative to fit
const MAX_ZOOM = 16

export default function MapView({ cfg, imageUrl, match, time, heat, heatOpacity, showHumans, showBots, visibleEvents }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitsRef = useRef<Hit[]>([])
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [hover, setHover] = useState<Hit | null>(null)

  // Track container size
  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load minimap image
  useEffect(() => {
    setImg(null)
    const im = new Image()
    im.onload = () => setImg(im)
    im.src = imageUrl
    return () => {
      im.onload = null
    }
  }, [imageUrl])

  const fitScale = size.w && size.h ? Math.min(size.w / cfg.w, size.h / cfg.h) * 0.96 : 1

  const fit = useCallback(() => {
    setView({ scale: fitScale, tx: (size.w - cfg.w * fitScale) / 2, ty: (size.h - cfg.h * fitScale) / 2 })
  }, [fitScale, size.w, size.h, cfg.w, cfg.h])

  // Re-fit when the map or the window size changes
  useEffect(fit, [fit])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setView((v) => {
        const scale = Math.min(fitScale * MAX_ZOOM, Math.max(fitScale * MIN_ZOOM, v.scale * factor))
        const k = scale / v.scale
        return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
      })
    },
    [fitScale],
  )

  // Wheel zoom needs a non-passive listener to stop the page scrolling
  useEffect(() => {
    const el = canvasRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Draw everything
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const { scale: s, tx, ty } = view
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty)
    const px = (u: number) => u * cfg.w
    const py = (v: number) => (1 - v) * cfg.h // image y grows downward, world z grows "up"

    if (img) ctx.drawImage(img, 0, 0, cfg.w, cfg.h)

    if (heat && heatOpacity > 0) {
      ctx.save()
      ctx.globalAlpha = heatOpacity
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(heat, 0, 0, cfg.w, cfg.h)
      ctx.restore()
    }

    const hits: Hit[] = []
    if (match) {
      const visible = (p: PlayerTrack) => (p.bot ? showBots : showHumans)

      // Paths: bots first so humans draw on top
      const order = [...match.players].sort((a, b) => Number(b.bot) - Number(a.bot))
      for (const p of order) {
        if (!visible(p) || p.t.length === 0) continue
        const style = p.bot ? PATH_STYLE.bot : PATH_STYLE.human
        const end = lastIndexAtOrBefore(p.t, time)
        if (end < 0) continue
        ctx.beginPath()
        ctx.moveTo(px(p.u[0]), py(p.v[0]))
        for (let i = 1; i <= end; i++) ctx.lineTo(px(p.u[i]), py(p.v[i]))
        const head = headPosition(p, time, end)
        ctx.lineTo(px(head.u), py(head.v))
        ctx.strokeStyle = style.color
        ctx.globalAlpha = p.bot ? 0.75 : 1
        ctx.lineWidth = style.width / s
        ctx.lineJoin = 'round'
        ctx.setLineDash(p.bot ? PATH_STYLE.bot.dash.map((d) => d / s) : [])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // Event markers
      for (const ev of match.events) {
        const [pi, type, t, u, v] = ev
        const player = match.players[pi]
        if (t > time || !visibleEvents.has(type) || !visible(player)) continue
        const x = px(u)
        const y = py(v)
        drawMarker(ctx, EVENT_STYLE[type].shape, EVENT_STYLE[type].color, x, y, MARKER_PX / s, s)
        hits.push({ x: x * s + tx, y: y * s + ty, ev, player })
      }

      // Current position dots (only while the player is still in the match)
      for (const p of order) {
        if (!visible(p) || p.t.length === 0) continue
        if (time < p.t[0] || time > p.t[p.t.length - 1]) continue
        const head = headPosition(p, time, lastIndexAtOrBefore(p.t, time))
        ctx.beginPath()
        ctx.arc(px(head.u), py(head.v), (p.bot ? 3.5 : 5.5) / s, 0, Math.PI * 2)
        ctx.fillStyle = p.bot ? PATH_STYLE.bot.color : PATH_STYLE.human.color
        ctx.fill()
        ctx.lineWidth = 1.5 / s
        ctx.strokeStyle = '#0b0d12'
        ctx.stroke()
      }
    }
    hitsRef.current = hits
  }, [size, view, img, heat, heatOpacity, match, time, showHumans, showBots, visibleEvents, cfg])

  // Clear stale hover when the data under it changes
  useEffect(() => setHover(null), [match, view])

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (drag) {
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      dragRef.current = { x: e.clientX, y: e.clientY }
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
      return
    }
    const r = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    let best: Hit | null = null
    let bestD = HIT_RADIUS_PX * HIT_RADIUS_PX
    for (const h of hitsRef.current) {
      const d = (h.x - mx) ** 2 + (h.y - my) ** 2
      if (d < bestD) {
        bestD = d
        best = h
      }
    }
    setHover(best)
  }

  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div className="mapview" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
      />
      {!img && <div className="map-loading">Loading map…</div>}
      <div className="zoom-controls">
        <button onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)} title="Zoom in">+</button>
        <button onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)} title="Zoom out">−</button>
        <button onClick={fit} title="Fit map to screen">Fit</button>
      </div>
      {hover && (
        <div className="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong style={{ color: EVENT_STYLE[hover.ev[1]].color }}>{eventHint(hover.ev[1], hover.player.bot)}</strong>
          <div>
            {hover.player.bot ? 'Bot' : 'Human'} {shortId(hover.player.id)} · at {mmss(hover.ev[2])}
          </div>
        </div>
      )}
    </div>
  )
}

/** Index of the last sample at or before time t, or -1 if the track starts later. */
function lastIndexAtOrBefore(ts: number[], t: number): number {
  let lo = 0
  let hi = ts.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ts[mid] <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

/** Position at time t, interpolated between samples so playback moves smoothly. */
function headPosition(p: PlayerTrack, t: number, i: number): { u: number; v: number } {
  if (i < 0) return { u: p.u[0], v: p.v[0] }
  if (i >= p.t.length - 1) return { u: p.u[i], v: p.v[i] }
  const span = p.t[i + 1] - p.t[i]
  const k = span > 0 ? (t - p.t[i]) / span : 0
  return { u: p.u[i] + (p.u[i + 1] - p.u[i]) * k, v: p.v[i] + (p.v[i + 1] - p.v[i]) * k }
}

function drawMarker(ctx: CanvasRenderingContext2D, shape: MarkerShape, color: string, x: number, y: number, r: number, s: number) {
  ctx.beginPath()
  switch (shape) {
    case 'x':
      ctx.moveTo(x - r, y - r)
      ctx.lineTo(x + r, y + r)
      ctx.moveTo(x + r, y - r)
      ctx.lineTo(x - r, y + r)
      ctx.lineCap = 'round'
      ctx.lineWidth = 5 / s
      ctx.strokeStyle = '#0b0d12'
      ctx.stroke()
      ctx.lineWidth = 2.5 / s
      ctx.strokeStyle = color
      ctx.stroke()
      return
    case 'square':
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6)
      break
    case 'triangle':
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r, y + r * 0.8)
      ctx.lineTo(x - r, y + r * 0.8)
      ctx.closePath()
      break
    case 'diamond': {
      const d = r * 0.75
      ctx.moveTo(x, y - d)
      ctx.lineTo(x + d, y)
      ctx.lineTo(x, y + d)
      ctx.lineTo(x - d, y)
      ctx.closePath()
      break
    }
  }
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 1.5 / s
  ctx.strokeStyle = '#0b0d12'
  ctx.stroke()
}
