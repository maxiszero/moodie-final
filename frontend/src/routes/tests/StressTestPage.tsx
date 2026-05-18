import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../../i18n/i18n'
import { appendTestHistory } from '../../ui/testResultsStorage'
import { STRESS_QUESTIONS, stressBand } from './stressTestData'
import { scrollToQuestionCard } from './scrollToNextQuestion'
import { TestsProgressBar } from './TestsProgressBar'

export function StressTestPage() {
  const saveOnce = useRef(false)
  const questionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [choices, setChoices] = useState<(number | null)[]>(() => STRESS_QUESTIONS.map(() => null))

  const answeredCount = choices.filter((c) => c !== null).length

  const result = useMemo(() => {
    if (choices.some((c) => c === null)) return null
    let total = 0
    STRESS_QUESTIONS.forEach((q, i) => {
      const idx = choices[i]
      if (idx == null) return
      total += q.options[idx]?.score ?? 0
    })
    const band = stressBand(total)
    const max = STRESS_QUESTIONS.length * 3
    const pct = Math.round((total / max) * 100)
    return { total, band, pct }
  }, [choices])

  useEffect(() => {
    if (!result || choices.some((c) => c === null)) {
      saveOnce.current = false
      return
    }
    if (saveOnce.current) return
    saveOnce.current = true
    const bandLabel = t(`test_stress_band_${result.band}`)
    appendTestHistory({
      kind: 'stress',
      completedAt: new Date().toISOString(),
      summary: `${bandLabel} · ${result.pct}%`,
      detail: { total: result.total, band: result.band },
    })
  }, [result, choices])

  useEffect(() => {
    if (!result) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [result])

  const pick = (questionIndex: number, optionIndex: number) => {
    const wasUnset = choices[questionIndex] === null
    const next = [...choices]
    next[questionIndex] = optionIndex
    setChoices(next)
    if (wasUnset && questionIndex + 1 < STRESS_QUESTIONS.length) {
      scrollToQuestionCard(questionRefs.current[questionIndex + 1])
    }
  }

  const restart = () => {
    saveOnce.current = false
    setChoices(STRESS_QUESTIONS.map(() => null))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (result) {
    return (
      <div className="tests-run tests-run--stress">
        <TestsProgressBar completed={STRESS_QUESTIONS.length} total={STRESS_QUESTIONS.length} />
        <h1 className="page-title">{t('test_stress_result_title')}</h1>
        <div className={`tests-stress-result tests-stress-result--${result.band}`}>
          <div className="tests-stress-result__score">{result.pct}%</div>
          <div className="tests-stress-result__band">{t(`test_stress_band_${result.band}`)}</div>
          <p className="tests-stress-result__hint">{t(`test_stress_band_hint_${result.band}`)}</p>
        </div>
        <p className="tests-saved-hint">{t('tests_saved_hint')}</p>
        <div className="tests-run__actions">
          <button type="button" className="auth-btn" onClick={restart}>
            {t('tests_again')}
          </button>
          <Link to="/tests" className="btn-secondary tests-run__back">
            {t('tests_back_hub')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="tests-run tests-run--stress">
      <TestsProgressBar completed={answeredCount} total={STRESS_QUESTIONS.length} />
      <h1 className="page-title">{t('test_stress_title')}</h1>
      <p className="tests-run__lead">{t('test_stress_lead')}</p>
      <div className="tests-questions">
        {STRESS_QUESTIONS.map((q, qi) => (
          <div
            key={q.id}
            className="tests-question-card"
            ref={(el) => {
              questionRefs.current[qi] = el
            }}
          >
            <div className="tests-question-card__num">
              {qi + 1}/{STRESS_QUESTIONS.length}
            </div>
            <h2 className="tests-question-card__q">{t(q.textKey)}</h2>
            <div className="tests-stress-scale">
              {q.options.map((opt, oi) => (
                <button
                  key={opt.labelKey}
                  type="button"
                  className={`tests-stress-opt ${choices[qi] === oi ? 'is-selected' : ''}`}
                  onClick={() => pick(qi, oi)}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Link to="/tests" className="btn-secondary tests-run__back">
        {t('tests_back_hub')}
      </Link>
    </div>
  )
}
