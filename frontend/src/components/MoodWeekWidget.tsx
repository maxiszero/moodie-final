import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/apiClient'
import { useSession } from '../state/SessionContext'
import type { MoodHeatmapDay } from '../types'
import { getLang, t } from '../i18n/i18n'
import { buildWeekHeatmapCells } from '../ui/heatmapCells'
import { streakLabel } from '../ui/streakLabel'

export function MoodWeekWidget() {
  const s = useSession()
  const [heatmap, setHeatmap] = useState<MoodHeatmapDay[]>([])
  const [streak, setStreak] = useState(0)
  const lang = getLang()

  useEffect(() => {
    if (!s.isAuthed || !s.username) return
    let alive = true
    Promise.all([
      apiFetch<MoodHeatmapDay[]>(`/users/${encodeURIComponent(s.username)}/heatmap`, { auth: true }),
      apiFetch<{ streak: number }>('/users/me/streak', { auth: true }),
    ])
      .then(([hm, st]) => {
        if (!alive) return
        setHeatmap(Array.isArray(hm) ? hm : [])
        setStreak(typeof st?.streak === 'number' ? st.streak : 0)
      })
      .catch(() => {
        if (alive) {
          setHeatmap([])
          setStreak(0)
        }
      })
    return () => {
      alive = false
    }
  }, [s.isAuthed, s.username])

  const cells = useMemo(() => buildWeekHeatmapCells(heatmap, lang), [heatmap, lang])

  if (!s.isAuthed || !s.username) return null

  return (
    <section className="mood-week-widget" aria-label={t('mood_week_title')}>
      <div className="mood-week-widget__head">
        <h2 className="mood-week-widget__title">
          {t('mood_week_title')}
          {streak > 0 ? (
            <span className="mood-week-widget__streak" title={t('streak_label')}>
              🔥 {streakLabel(streak, lang)}
            </span>
          ) : null}
        </h2>
        <Link className="mood-week-widget__link" to={`/profile/${encodeURIComponent(s.username)}`}>
          {t('mood_week_open_profile')}
        </Link>
      </div>
      <div className="mood-week-widget__grid">
        {cells.map((c) => (
          <div key={c.key} className="mood-week-widget__cell-wrap">
            <div className="mood-week-widget__cell" style={{ background: c.color }} title={c.title} />
            <span className="mood-week-widget__label">{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
