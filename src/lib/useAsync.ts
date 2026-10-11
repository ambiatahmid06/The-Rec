import { useCallback, useEffect, useState } from 'react'

/**
 * Runs an async loader when the component mounts (and whenever `load` changes),
 * and tracks its result. Wrap `load` in useCallback so it only re-runs when needed.
 */
export function useAsync<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false // ignore results that arrive after leaving the page
    load().then(
      (result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setLoading(false)
      },
      (e: Error) => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [load])

  /** Loads again, e.g. after making a change. */
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await load())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [load])

  return { data, error, loading, reload }
}
