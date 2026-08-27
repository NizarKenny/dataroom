import { useEffect, useState } from 'react'

/** Waits for the typing to stop, so a search is one request rather than one per key. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return settled
}
