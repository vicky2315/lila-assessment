import type { DataIndex, MapId } from './types'

// BASE_URL comes from 'base' in vite.config.ts ('/lila-assessment/'), so paths work under the Pages sub-path
const base = import.meta.env.BASE_URL

export const minimapUrl = (map: MapId) => `${base}minimaps/${map}.webp`

export async function loadIndex(): Promise<DataIndex> {
  const res = await fetch(`${base}data/index.json`)
  if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`)
  return res.json()
}
