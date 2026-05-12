import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Post } from '../types'
import { getSocket } from './socket'
import { t } from '../i18n/i18n'
import { tryBrowserNotifyDaily } from '../ui/dailyNotifications'

type RealtimeValue = {
  onlineCount: number | null
  lastNewPost: Post | null
  /** UTC day key when server broadcast a new calendar day */
  dailyRolloverKey: string | null
  /** Incremented when someone posts a daily answer (refresh anonymous list) */
  dailyAnswerTick: number
}

const Ctx = createContext<RealtimeValue | null>(null)

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [lastNewPost, setLastNewPost] = useState<Post | null>(null)
  const [dailyRolloverKey, setDailyRolloverKey] = useState<string | null>(null)
  const [dailyAnswerTick, setDailyAnswerTick] = useState(0)

  useEffect(() => {
    const s = getSocket()

    const onOnline = (count: number) => setOnlineCount(count)
    const onNewPost = (post: Post) => setLastNewPost(post)
    const onDailyDay = (payload: { dayKey?: string }) => {
      const dk = typeof payload?.dayKey === 'string' ? payload.dayKey : null
      if (dk) {
        setDailyRolloverKey(dk)
        tryBrowserNotifyDaily(dk, t('daily_notify_title'), t('daily_notify_body'))
      }
    }
    const onDailyAnswer = () => setDailyAnswerTick((n) => n + 1)

    s.on('online_count', onOnline)
    s.on('new_post', onNewPost)
    s.on('daily_question_day', onDailyDay)
    s.on('daily_answer', onDailyAnswer)

    return () => {
      s.off('online_count', onOnline)
      s.off('new_post', onNewPost)
      s.off('daily_question_day', onDailyDay)
      s.off('daily_answer', onDailyAnswer)
    }
  }, [])

  const value = useMemo(
    () => ({ onlineCount, lastNewPost, dailyRolloverKey, dailyAnswerTick }),
    [dailyAnswerTick, dailyRolloverKey, lastNewPost, onlineCount],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRealtime() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRealtime must be used within RealtimeProvider')
  return v
}

