import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/apiClient'
import { t } from '../i18n/i18n'
import { useSession } from '../state/SessionContext'

export type MoodNeighborSnippet = {
  emoji: string
  emotion: string
  text: string
  agoMinutes: number
}

export type MoodNeighborsPayload = {
  count: number
  matchMode: 'emotion' | 'bucket'
  emotion: string
  emotionLabel: string
  bucket: string
  expiresInSec: number
  snippets: MoodNeighborSnippet[]
}

type Props = {
  enabled?: boolean
}

export function MoodNeighborsPanel({ enabled = true }: Props) {
  const s = useSession()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<MoodNeighborsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    if (!s.isAuthed || !enabled) return
    setLoading(true)
    setErr('')
    try {
      await apiFetch('/mood-neighbors/join', { method: 'POST' })
      const payload = await apiFetch<MoodNeighborsPayload>('/mood-neighbors')
      setData(payload)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error'
      setErr(msg)
    } finally {
      setLoading(false)
    }
  }, [enabled, s.isAuthed])

  useEffect(() => {
    if (!open || !s.isAuthed) return
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [open, refresh, s.isAuthed])

  if (!s.isAuthed || !enabled) return null

  const count = data?.count ?? 0
  const emotionLabel = data?.emotionLabel || s.mood.emotion || 'neutral'

  return (
    <section className="mood-neighbors" aria-label={t('mood_neighbors_title')}>
      <button
        type="button"
        className={`mood-neighbors__toggle ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mood-neighbors__toggle-icon" aria-hidden>
          🤝
        </span>
        <span className="mood-neighbors__toggle-text">
          <strong>{t('mood_neighbors_title')}</strong>
          <small>{open ? t('mood_neighbors_sub_open') : t('mood_neighbors_sub')}</small>
        </span>
        {open && data ? (
          <span className="mood-neighbors__count">{count}</span>
        ) : null}
      </button>

      {open ? (
        <div className="mood-neighbors__body">
          {loading && !data ? <p className="mood-neighbors__hint">{t('loading_posts')}</p> : null}
          {err ? <p className="mood-neighbors__err">{err}</p> : null}
          {data ? (
            <>
              <p className="mood-neighbors__lead">
                {count > 0
                  ? t('mood_neighbors_count')
                      .replace('{n}', String(count))
                      .replace('{e}', emotionLabel)
                  : t('mood_neighbors_empty').replace('{e}', emotionLabel)}
              </p>
              <p className="mood-neighbors__hint">{t('mood_neighbors_anon_hint')}</p>
              {data.snippets.length > 0 ? (
                <ul className="mood-neighbors__list">
                  {data.snippets.map((snip, i) => (
                    <li key={`${snip.text.slice(0, 24)}-${i}`} className="mood-neighbors__item">
                      <span className="mood-neighbors__emoji" aria-hidden>
                        {snip.emoji}
                      </span>
                      <div className="mood-neighbors__quote">
                        <p>{snip.text}</p>
                        <time className="mood-neighbors__ago">
                          {t('mood_neighbors_ago').replace('{m}', String(snip.agoMinutes))}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : count > 0 ? (
                <p className="mood-neighbors__hint">{t('mood_neighbors_no_posts')}</p>
              ) : null}
              <button type="button" className="btn-secondary mood-neighbors__refresh" disabled={loading} onClick={() => void refresh()}>
                {loading ? t('loading_posts') : t('mood_neighbors_refresh')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
