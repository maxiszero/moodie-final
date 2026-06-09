import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/apiClient'
import { t } from '../i18n/i18n'
import { useSession } from '../state/SessionContext'

type EveningToday = {
  dayKey: string
  hasAnswered: boolean
  choice: string | null
  choiceLabel: string | null
  canAnswer: boolean
}

const CHOICES = ['hard', 'ok', 'good'] as const

export function EveningReviewCard() {
  const s = useSession()
  const [data, setData] = useState<EveningToday | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!s.isAuthed) return
    try {
      const payload = await apiFetch<EveningToday>('/evening-review/today')
      setData(payload)
      setErr('')
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error'
      setErr(msg)
    }
  }, [s.isAuthed])

  useEffect(() => {
    void load()
  }, [load])

  if (!s.isAuthed) return null

  const submit = async (choice: (typeof CHOICES)[number]) => {
    setBusy(true)
    setErr('')
    try {
      const payload = await apiFetch<EveningToday>('/evening-review/answer', {
        method: 'POST',
        body: JSON.stringify({ choice }),
      })
      setData(payload)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error'
      setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="evening-review-card" aria-label={t('evening_review_title')}>
      <h3 className="evening-review-card__title">{t('evening_review_title')}</h3>
      <p className="evening-review-card__lead">{t('evening_review_lead')}</p>
      {err ? <p className="evening-review-card__err">{err}</p> : null}
      {data?.hasAnswered ? (
        <p className="evening-review-card__done">
          {t('evening_review_done').replace('{label}', data.choiceLabel || data.choice || '')}
        </p>
      ) : (
        <div className="evening-review-card__choices">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`evening-review-card__btn evening-review-card__btn--${choice}`}
              disabled={busy}
              onClick={() => void submit(choice)}
            >
              {t(`evening_review_${choice}`)}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
