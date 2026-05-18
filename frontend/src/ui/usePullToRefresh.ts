import { useEffect, useRef, useState } from 'react'

type Options = {
  enabled?: boolean
  threshold?: number
  onRefresh: () => Promise<void> | void
}

export function usePullToRefresh({ enabled = true, threshold = 72, onRefresh }: Options) {
  const [offset, setOffset] = useState(0)
  const startYRef = useRef(0)
  const busyRef = useRef(false)
  const pullingRef = useRef(false)
  const offsetRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const onTouchStart = (e: TouchEvent) => {
      if (busyRef.current) return
      const root = document.scrollingElement ?? document.documentElement
      if (root.scrollTop > 4) return
      startYRef.current = e.touches[0]?.clientY ?? 0
      pullingRef.current = true
      setOffset(0)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || busyRef.current) return
      const y = e.touches[0]?.clientY ?? 0
      const delta = Math.max(0, y - startYRef.current)
      const next = Math.min(delta * 0.45, threshold * 1.4)
      offsetRef.current = next
      setOffset(next)
    }

    const finish = async () => {
      if (!pullingRef.current) return
      pullingRef.current = false
      const off = offsetRef.current
      offsetRef.current = 0
      setOffset(0)
      if (off >= threshold && !busyRef.current) {
        busyRef.current = true
        try {
          await onRefresh()
        } finally {
          busyRef.current = false
        }
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', finish)
    window.addEventListener('touchcancel', finish)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', finish)
      window.removeEventListener('touchcancel', finish)
    }
  }, [enabled, onRefresh, threshold])

  return { pullOffset: offset, pullActive: offset > 8 }
}
