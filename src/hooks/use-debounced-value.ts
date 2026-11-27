import { useEffect, useState } from "react"

/**
 * Returns `value` after it has stopped changing for `delay` ms. A delay of 0
 * passes the value straight through, with no stale render in between.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  if (delay === 0 && debounced !== value) setDebounced(value)

  useEffect(() => {
    if (delay === 0) return
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return delay === 0 ? value : debounced
}
