import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../../i18n/i18n'
import { useSession } from '../../state/SessionContext'
import {
  formatTestCompletedAt,
  loadTestHistory,
  type TestHistoryEntry,
} from '../../ui/testResultsStorage'

export function TestsHubPage() {
  const s = useSession()
  const [history, setHistory] = useState<TestHistoryEntry[]>(() => loadTestHistory())

  useEffect(() => {
    setHistory(loadTestHistory())
  }, [s.userId])

  const lastEm = useMemo(() => history.find((h) => h.kind === 'emotions'), [history])
  const lastMb = useMemo(() => history.find((h) => h.kind === 'mbti'), [history])
  const lastStress = useMemo(() => history.find((h) => h.kind === 'stress'), [history])

  return (
    <div id="testsHub" className="tests-hub">
      <div className="tests-hub__header">
        <h1 className="page-title tests-hub__title">{t('tests_title')}</h1>
        <p className="tests-hub__lead">{t('tests_lead')}</p>
      </div>

      <ul className="tests-hub__grid">
        <li>
          <Link to="/tests/emotions" className="tests-card tests-card--emotions">
            <div className="tests-card__shine" aria-hidden />
            <span className="tests-card__icon" aria-hidden>
              🎭
            </span>
            <span className="tests-card__title">{t('tests_card_emotions_title')}</span>
            <span className="tests-card__desc">{t('tests_card_emotions_desc')}</span>
            {lastEm ? (
              <div className="tests-card__foot">
                <span className="tests-card__last-label">{t('tests_last_label')}</span>
                <span className="tests-card__last-sum">{lastEm.summary}</span>
                <time className="tests-card__last-when" dateTime={lastEm.completedAt}>
                  {formatTestCompletedAt(lastEm.completedAt, s.lang)}
                </time>
              </div>
            ) : (
              <span className="tests-card__badge tests-card__badge--new">{t('tests_not_yet')}</span>
            )}
          </Link>
        </li>
        <li>
          <Link to="/tests/mbti" className="tests-card tests-card--mbti">
            <div className="tests-card__shine" aria-hidden />
            <span className="tests-card__icon" aria-hidden>
              🧩
            </span>
            <span className="tests-card__title">{t('tests_card_mbti_title')}</span>
            <span className="tests-card__desc">{t('tests_card_mbti_desc')}</span>
            {lastMb ? (
              <div className="tests-card__foot">
                <span className="tests-card__last-label">{t('tests_last_label')}</span>
                <span className="tests-card__last-sum tests-card__last-sum--type">{lastMb.summary}</span>
                <time className="tests-card__last-when" dateTime={lastMb.completedAt}>
                  {formatTestCompletedAt(lastMb.completedAt, s.lang)}
                </time>
              </div>
            ) : (
              <span className="tests-card__badge tests-card__badge--new">{t('tests_not_yet')}</span>
            )}
          </Link>
        </li>
        <li>
          <Link to="/tests/stress" className="tests-card tests-card--stress">
            <div className="tests-card__shine" aria-hidden />
            <span className="tests-card__icon" aria-hidden>
              🌡️
            </span>
            <span className="tests-card__title">{t('tests_card_stress_title')}</span>
            <span className="tests-card__desc">{t('tests_card_stress_desc')}</span>
            {lastStress ? (
              <div className="tests-card__foot">
                <span className="tests-card__last-label">{t('tests_last_label')}</span>
                <span className="tests-card__last-sum">{lastStress.summary}</span>
                <time className="tests-card__last-when" dateTime={lastStress.completedAt}>
                  {formatTestCompletedAt(lastStress.completedAt, s.lang)}
                </time>
              </div>
            ) : (
              <span className="tests-card__badge tests-card__badge--new">{t('tests_not_yet')}</span>
            )}
          </Link>
        </li>
      </ul>

      {history.length > 0 ? (
        <section className="tests-history" aria-label={t('tests_history_title')}>
          <h2 className="tests-history__title">{t('tests_history_title')}</h2>
          <p className="tests-history__scope">{t('tests_history_scope')}</p>
          <ul className="tests-history__list">
            {history.slice(0, 20).map((h) => (
              <li key={h.id} className="tests-history__item">
                <span className="tests-history__icon" aria-hidden>
                  {h.kind === 'emotions' ? '🎭' : h.kind === 'mbti' ? '🧩' : '🌡️'}
                </span>
                <div className="tests-history__body">
                  <div className="tests-history__summary">{h.summary}</div>
                  <time className="tests-history__when" dateTime={h.completedAt}>
                    {formatTestCompletedAt(h.completedAt, s.lang)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="tests-history__empty">{t('tests_history_empty')}</p>
      )}
    </div>
  )
}
