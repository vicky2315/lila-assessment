import { useCallback, useEffect, useState } from 'react'

/**
 * Keeps a small set of string params in the URL hash (#map=...&days=...),
 * so any view can be shared as a link. Uses replaceState to avoid flooding history.
 */
export function useHashState<K extends string>(): [Partial<Record<K, string>>, (patch: Partial<Record<K, string | null>>) => void] {
  const read = () => Object.fromEntries(new URLSearchParams(window.location.hash.slice(1))) as Partial<Record<K, string>>
  const [params, setParams] = useState(read)

  useEffect(() => {
    const onHash = () => setParams(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const update = useCallback((patch: Partial<Record<K, string | null>>) => {
    setParams((prev) => {
      const next: Record<string, string> = { ...prev } as Record<string, string>
      for (const [k, v] of Object.entries(patch) as [string, string | null | undefined][]) {
        if (v === null || v === undefined || v === '') delete next[k]
        else next[k] = v
      }
      const hash = new URLSearchParams(next).toString()
      window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search)
      return next as Partial<Record<K, string>>
    })
  }, [])

  return [params, update]
}
