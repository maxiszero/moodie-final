import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/apiClient'
import type { DailyAnonymousAnswer, DailyQuestionToday } from '../types'
import { t, getLang } from '../i18n/i18n'
import { useSession } from '../state/SessionContext'
import { useRealtime } from '../realtime/RealtimeContext'
import { useToast } from '../ui/toastProvider'

function anonKey(a: DailyAnonymousAnswer, i: number) {
  return `${a.createdAt}:${i}:${a.text.slice(0, 24)}`
}

type Props = {
  today: DailyQuestionToday | null
  onTodayUpdate: (next: DailyQuestionToday) => void
}

export function DailyQuestionFeed({ today, onTodayUpdate }: Props) {
  const s = useSession()
  const rt = useRealtime()
  const { showToast } = useToast()
  const [answers, setAnswers] = useState<DailyAnonymousAnswer[]>([])
  const [loadingA, setLoadingA] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const dayKey = today?.dayKey

  const loadAnswers = useCallback(async () => {
    if (!dayKey) return
    setLoadingA(true)
    try {
      const res = await apiFetch<{ answers: DailyAnonymousAnswer[] }>(
        `/daily-question/answers?dayKey=${encodeURIComponent(dayKey)}&limit=40`,
        { auth: false },
      )
      setAnswers(Array.isArray(res.answers) ? res.answers : [])
    } catch {
      setAnswers([])
    } finally {
      setLoadingA(false)
    }
  }, [dayKey])

  useEffect(() => {
    void loadAnswers()
  }, [loadAnswers, rt.dailyAnswerTick])

  useEffect(() => {
    if (today?.myAnswer) setDraft(today.myAnswer)
    else setDraft('')
  }, [today?.myAnswer, today?.dayKey])

  const submit = async () => {
    if (!s.isAuthed || !today?.canAnswer) return
    const text = draft.trim()
    if (!text) return
    setBusy(true)
    try {
      const lang = getLang()
      const next = await apiFetch<DailyQuestionToday>(`/daily-question/answer?lang=${lang}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      onTodayUpdate(next)
      showToast(t('daily_saved_toast'), 'success')
      void loadAnswers()
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error'
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!today) {
    return (
      <div className="daily-question">
        <div className="loader">{t('loading_posts')}</div>
      </div>
    )
  }

  return (
    <div className="daily-question" id="dailyQuestionFeed">
      <p className="daily-question__intro">{t('daily_intro')}</p>
      <div className="daily-question__card">
        <p className="daily-question__q">{today.question}</p>
        <p className="daily-question__hint">{t('daily_mood_hint')}</p>
        {s.isAuthed && today.canAnswer ? (
          <>
            <label className="daily-question__label" htmlFor="dailyAnswerInput">
              {t('daily_your_answer')}
            </label>
            <textarea
              id="dailyAnswerInput"
              className="daily-question__textarea"
              rows={4}
              maxLength={600}
              placeholder={t('daily_placeholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="button" className="auth-btn daily-question__submit" disabled={busy || !draft.trim()} onClick={() => void submit()}>
              {busy ? t('daily_saving') : today.hasAnswered ? t('daily_update') : t('daily_submit')}
            </button>
          </>
        ) : (
          <p className="daily-question__login-hint">{t('daily_login_hint')}</p>
        )}
      </div>

      <h3 className="daily-question__feed-title">{t('daily_anon_feed')}</h3>
      {loadingA && answers.length === 0 ? (
        <p className="daily-question__loading">{t('loading_posts')}</p>
      ) : null}
      {!loadingA && answers.length === 0 ? (
        <p className="daily-question__empty">{t('daily_empty_answers')}</p>
      ) : null}
      <ul className="daily-question__list" aria-label={t('daily_anon_feed')}>
        {answers.map((a, i) => (
          <li key={anonKey(a, i)} className="daily-question__anon">
            <p className="daily-question__anon-text">{a.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
