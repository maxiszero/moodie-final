import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api/apiClient'

export type MoodStatRow = { _id: string; count: number; emoji?: string; color?: string }

type Ctx = {
  stats: MoodStatRow[]
  emotionFilter: string | null
  setEmotionFilter: (m: string | null) => void
  refetchStats: () => Promise<void>
}

const Ctx = createContext<Ctx | null>(null)

export function FeedMoodProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<MoodStatRow[]>([])
  const [emotionFilter, setEmotionFilter] = useState<string | null>(null)

  const refetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<MoodStatRow[]>('/posts/stats/mood', { auth: false })
      setStats(Array.isArray(data) ? data : [])
    } catch {
      setStats([])
    }
  }, [])

  useEffect(() => {
    void refetchStats()
  }, [refetchStats])

  const v = useMemo(
    () => ({ stats, emotionFilter, setEmotionFilter, refetchStats }),
    [stats, emotionFilter, refetchStats],
  )
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

export function useFeedMood() {
  const x = useContext(Ctx)
  if (!x) throw new Error('useFeedMood must be used within FeedMoodProvider')
  return x
}
