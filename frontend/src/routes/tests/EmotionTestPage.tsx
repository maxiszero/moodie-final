import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../../i18n/i18n'
import { appendTestHistory } from '../../ui/testResultsStorage'
import { EMOTION_TEST_QUESTIONS } from './emotionTestData'
import { scrollToQuestionCard } from './scrollToNextQuestion'
import { TestsProgressBar } from './TestsProgressBar'

function aggregateScores(choices: (number | null)[]) {
  const total: Record<string, number> = {}
  EMOTION_TEST_QUESTIONS.forEach((q, i) => {
    const idx = choices[i]
    if (idx == null) return
    const opt = q.options[idx]
    if (!opt) return
    Object.entries(opt.weights).forEach(([k, v]) => {
      if (typeof v !== 'number') return
      total[k] = (total[k] || 0) + v
    })
  })
  return total
}

function emotionLabel(key: string) {
  const k = `test_em_key_${key}` as const
  const label = t(k)
  return label === k ? key : label
}

export function EmotionTestPage() {
  const saveOnce = useRef(false)
  const questionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [choices, setChoices] = useState<(number | null)[]>(() => EMOTION_TEST_QUESTIONS.map(() => null))

  const answeredCount = choices.filter((c) => c !== null).length

  const result = useMemo(() => {
    if (choices.some((c) => c === null)) return null
    const raw = aggregateScores(choices)
    const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1
    return Object.entries(raw)
      .map(([emotion, score]) => ({ emotion, score, pct: Math.round((score / sum) * 100) }))
      .sort((a, b) => b.score - a.score)
  }, [choices])

  useEffect(() => {
    if (!result?.length || choices.some((c) => c === null)) {
      saveOnce.current = false
      return
    }
    if (saveOnce.current) return
    saveOnce.current = true
    const top3 = result.slice(0, 3)
    const summary = top3.map((r) => `${emotionLabel(r.emotion)} ${r.pct}%`).join(' · ')
    appendTestHistory({
      kind: 'emotions',
      completedAt: new Date().toISOString(),
      summary,
      detail: { top: result.slice(0, 5) },
    })
  }, [result, choices])

  useEffect(() => {
    if (!result?.length) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [result])

  const pick = (questionIndex: number, optionIndex: number) => {
    const wasUnset = choices[questionIndex] === null
    const next = [...choices]
    next[questionIndex] = optionIndex
    setChoices(next)
    if (wasUnset && questionIndex + 1 < EMOTION_TEST_QUESTIONS.length) {
      scrollToQuestionCard(questionRefs.current[questionIndex + 1])
    }
  }

  const restart = () => {
    saveOnce.current = false
    setChoices(EMOTION_TEST_QUESTIONS.map(() => null))
  }

  if (result && result.length > 0) {
    const top = result.slice(0, 5)
    return (
      <div className="tests-run tests-run--result">
        <div className="tests-result-hero tests-result-hero--emotion">
          <div className="tests-result-hero__glow" aria-hidden />
          <h1 className="tests-result-hero__title">{t('tests_em_result_title')}</h1>
          <p className="tests-result-hero__sub">{t('tests_em_result_hint')}</p>
        </div>
        <ul className="tests-result-list">
          {top.map((row) => (
            <li key={row.emotion} className="tests-result-row">
              <span className="tests-result-row__label">{emotionLabel(row.emotion)}</span>
              <div className="tests-result-bar" role="presentation">
                <div className="tests-result-bar__fill" style={{ width: `${Math.min(100, row.pct)}%` }} />
              </div>
              <span className="tests-result-row__pct">{row.pct}%</span>
            </li>
          ))}
        </ul>
        <p className="tests-saved-hint">{t('tests_saved_hint')}</p>
        <div className="tests-run__actions">
          <button type="button" className="btn-secondary" onClick={restart}>
            {t('tests_again')}
          </button>
          <Link to="/tests" className="auth-btn tests-run__back">
            {t('tests_back_hub')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="tests-run">
      <div className="tests-run__head">
        <Link to="/tests" className="tests-run__to-hub">
          ← {t('tests_back_hub')}
        </Link>
        <p className="tests-run__progress">
          {t('tests_progress')
            .replace('{n}', String(answeredCount))
            .replace('{t}', String(EMOTION_TEST_QUESTIONS.length))}
        </p>
      </div>
      <h1 className="page-title tests-run__page-title">{t('tests_em_title')}</h1>
      <TestsProgressBar completed={answeredCount} total={EMOTION_TEST_QUESTIONS.length} />
      <div className="tests-questions-stack">
        {EMOTION_TEST_QUESTIONS.map((q, qi) => (
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[qi] = el
            }}
            className="tests-question tests-question--card tests-question--in-stack"
          >
            <p className="tests-question__text">{t(q.promptKey)}</p>
            <div className="tests-options">
              {q.options.map((opt, i) => (
                <button
                  key={opt.labelKey}
                  type="button"
                  className={`tests-option ${choices[qi] === i ? 'tests-option--selected' : ''}`}
                  aria-pressed={choices[qi] === i}
                  onClick={() => pick(qi, i)}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
