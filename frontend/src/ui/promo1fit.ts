import { useEffect, useState } from 'react'
import type { Lang } from '../types'
import { getLang } from '../i18n/i18n'

/** Окончание акции 1FIT: 2 июня, конец дня (локальное время). */
export const FIT_PROMO_END = new Date(2026, 5, 2, 23, 59, 59)

export function msUntilFitPromoEnd(now = Date.now()) {
  return FIT_PROMO_END.getTime() - now
}

export function formatFitPromoCountdown(ms: number, lang: Lang): string {
  if (ms <= 0) return ''
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (lang === 'en') {
    if (days > 0) return `${days}d ${h}h ${m}m ${s}s`
    return `${h}h ${m}m ${s}s`
  }
  if (days > 0) return `${days}д ${h}ч ${m}м ${s}с`
  return `${h}ч ${m}м ${s}с`
}

export function useFitPromoCountdown() {
  const [ms, setMs] = useState(() => msUntilFitPromoEnd())

  useEffect(() => {
    const id = window.setInterval(() => setMs(msUntilFitPromoEnd()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const lang = getLang()
  const expired = ms <= 0
  const countdown = expired ? '' : formatFitPromoCountdown(ms, lang)

  return { expired, countdown, ms }
}
