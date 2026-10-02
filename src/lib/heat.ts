import type { EventType, HeatFile, HeatLayer, MatchDetail } from '../types'

// Same layer definitions as HEAT_LAYERS in scripts/preprocess.py
const LAYER_EVENTS: Record<Exclude<HeatLayer, 'traffic'>, EventType[]> = {
  kills: ['Kill', 'BotKill'],
  deaths: ['Killed', 'BotKilled', 'KilledByStorm'],
  storm: ['KilledByStorm'],
  loot: ['Loot'],
}

/** Coarser grid for one match: it has far fewer points, so bigger cells read better. */
export const MATCH_HEAT_BINS = 64

/**
 * Heat grid for one match, counting only what happened up to `time`
 * so the heatmap builds up during playback. Respects the human/bot toggles.
 */
export function matchHeat(
  match: MatchDetail,
  layer: HeatLayer,
  time: number,
  showHumans: boolean,
  showBots: boolean,
): { grid: Float32Array; total: number } {
  const bins = MATCH_HEAT_BINS
  const grid = new Float32Array(bins * bins)
  let total = 0
  const add = (u: number, v: number) => {
    const col = Math.min(bins - 1, Math.max(0, Math.floor(u * bins)))
    const row = Math.min(bins - 1, Math.max(0, Math.floor((1 - v) * bins)))
    grid[row * bins + col]++
    total++
  }
  const visible = (bot: boolean) => (bot ? showBots : showHumans)

  if (layer === 'traffic') {
    for (const p of match.players) {
      if (!visible(p.bot)) continue
      for (let i = 0; i < p.t.length && p.t[i] <= time; i++) add(p.u[i], p.v[i])
    }
  } else {
    const types = LAYER_EVENTS[layer]
    for (const [pi, type, t, u, v] of match.events) {
      if (t <= time && types.includes(type) && visible(match.players[pi].bot)) add(u, v)
    }
  }
  return { grid, total }
}

/** Add up one layer across the selected days into a dense bins x bins grid. */
export function sumHeat(file: HeatFile, days: string[], layer: HeatLayer): { grid: Float32Array; total: number } {
  const grid = new Float32Array(file.bins * file.bins)
  let total = 0
  for (const day of days) {
    const cells = file.days[day]?.[layer]
    if (!cells) continue
    for (const [i, c] of cells) {
      grid[i] += c
      total += c
    }
  }
  return { grid, total }
}

// Transparent -> purple -> red -> orange -> yellow. Stops are [position, r, g, b, alpha].
const RAMP: [number, number, number, number, number][] = [
  [0.0, 60, 0, 120, 0],
  [0.25, 120, 30, 170, 70],
  [0.5, 230, 40, 60, 170],
  [0.75, 255, 150, 20, 215],
  [1.0, 255, 245, 120, 240],
]

/** The same ramp as a CSS gradient, for the colour key in the sidebar */
export const RAMP_GRADIENT = `linear-gradient(to right, ${RAMP.map(([p, r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)}) ${p * 100}%`).join(', ')})`

function rampColor(x: number): [number, number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    const [p1, ...c1] = RAMP[i]
    const [p0, ...c0] = RAMP[i - 1]
    if (x <= p1) {
      const k = (x - p0) / (p1 - p0)
      return c0.map((c, j) => c + (c1[j] - c) * k) as [number, number, number, number]
    }
  }
  return RAMP[RAMP.length - 1].slice(1) as [number, number, number, number]
}

/**
 * Render a grid to a small canvas (1 px per cell). The map view scales it up with smoothing and blur.
 * Uses sqrt scaling so a few very hot cells don't wash out everything else.
 * `intensity` multiplies the colour's alpha after the blur. Sparse layers (few events) blur out thin,
 * so this makes them easier to see without changing which colour a cell gets.
 */
export function heatToCanvas(grid: Float32Array, bins: number, intensity = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = bins
  canvas.height = bins
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(bins, bins)
  const cap = percentile(grid, 0.98)
  if (cap > 0) {
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]) continue
      const [r, g, b, a] = rampColor(Math.min(1, grid[i] / cap) ** 0.6)
      img.data.set([r, g, b, a], i * 4)
    }
  }
  ctx.putImageData(img, 0, 0)

  // Upscale once with a blur so cells read as smooth zones, not squares.
  // Done here (not per frame) because canvas blur filters are slow.
  const out = document.createElement('canvas')
  out.width = out.height = HEAT_RENDER_PX
  const octx = out.getContext('2d')!
  octx.imageSmoothingEnabled = true
  octx.filter = `blur(${HEAT_BLUR_PX}px)`
  octx.drawImage(canvas, 0, 0, HEAT_RENDER_PX, HEAT_RENDER_PX)
  if (intensity !== 1) {
    const px = octx.getImageData(0, 0, HEAT_RENDER_PX, HEAT_RENDER_PX)
    const d = px.data
    for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, d[i] * intensity)
    octx.putImageData(px, 0, 0)
  }
  return out
}

/**
 * Value at quantile q among non-empty cells. Normalising to this instead of the max
 * stops one extreme cell (e.g. a spawn point) from making everything else look cold.
 */
function percentile(grid: Float32Array, q: number): number {
  const vals = Array.from(grid.filter((c) => c > 0)).sort((a, b) => a - b)
  if (!vals.length) return 0
  return vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]
}

const HEAT_RENDER_PX = 512
const HEAT_BLUR_PX = 5
