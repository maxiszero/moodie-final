import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../../i18n/i18n'
import { useSession } from '../../state/SessionContext'
import {
  appendTestHistory,
  formatTestCompletedAt,
  loadTestHistory,
  type TestHistoryEntry,
} from '../../ui/testResultsStorage'
import { MBTI_QUESTIONS, type MbtiAxis } from './mbtiTestData'
import { scrollToQuestionCard } from './scrollToNextQuestion'
import { TestsProgressBar } from './TestsProgressBar'

function axisLetters(axis: MbtiAxis): [string, string] {
  switch (axis) {
    case 'EI':
      return ['E', 'I']
    case 'SN':
      return ['S', 'N']
    case 'TF':
      return ['T', 'F']
    case 'JP':
      return ['J', 'P']
    default:
      return ['?', '?']
  }
}

function tally(agree: (boolean | null)[]) {
  const counts: Record<string, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
  MBTI_QUESTIONS.forEach((q, i) => {
    const agreed = agree[i]
    if (agreed == null) return
    const [first, second] = axisLetters(q.axis)
    if (agreed === q.towardFirst) counts[first]++
    else counts[second]++
  })
  return counts
}

function typeFromCounts(c: Record<string, number>) {
  const e = (c.E || 0) >= (c.I || 0) ? 'E' : 'I'
  const s = (c.S || 0) >= (c.N || 0) ? 'S' : 'N'
  const tf = (c.T || 0) >= (c.F || 0) ? 'T' : 'F'
  const jp = (c.J || 0) >= (c.P || 0) ? 'J' : 'P'
  return `${e}${s}${tf}${jp}`
}

function axisSplit(c: Record<string, number>, a: string, b: string) {
  const ca = c[a] ?? 0
  const cb = c[b] ?? 0
  const tot = ca + cb || 1
  return {
    aPct: Math.round((ca / tot) * 100),
    bPct: Math.round((cb / tot) * 100),
    ca,
    cb,
  }
}

const MBTI_AXIS_ROWS: ReadonlyArray<{
  a: 'E' | 'S' | 'T' | 'J'
  b: 'I' | 'N' | 'F' | 'P'
  titleKey: 'tests_mbti_axis_ei' | 'tests_mbti_axis_sn' | 'tests_mbti_axis_tf' | 'tests_mbti_axis_jp'
}> = [
  { a: 'E', b: 'I', titleKey: 'tests_mbti_axis_ei' },
  { a: 'S', b: 'N', titleKey: 'tests_mbti_axis_sn' },
  { a: 'T', b: 'F', titleKey: 'tests_mbti_axis_tf' },
  { a: 'J', b: 'P', titleKey: 'tests_mbti_axis_jp' },
]

export function MbtiTestPage() {
  const s = useSession()
  const saveSig = useRef<string | null>(null)
  const [mbtiRecent, setMbtiRecent] = useState<TestHistoryEntry[]>([])
  const questionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => MBTI_QUESTIONS.map(() => null))

  const answeredCount = answers.filter((a) => a !== null).length

  const done = answers.every((a) => a !== null)
  const type = useMemo(() => {
    if (!done) return null
    return typeFromCounts(tally(answers))
  }, [answers, done])

  const axisCounts = useMemo(() => (done ? tally(answers) : null), [answers, done])

  useEffect(() => {
    if (!done || !type) return
    const sig = `${type}|${answers.map((a) => (a ? '1' : '0')).join('')}`
    if (saveSig.current !== sig) {
      saveSig.current = sig
      appendTestHistory({
        kind: 'mbti',
        completedAt: new Date().toISOString(),
        summary: type,
        detail: { type },
      })
    }
    setMbtiRecent(loadTestHistory().filter((h) => h.kind === 'mbti').slice(0, 6))
  }, [done, type, answers])

  useEffect(() => {
    if (!done || !type) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [done, type])

  const setAnswer = (index: number, agree: boolean) => {
    const wasUnset = answers[index] === null
    const next = [...answers]
    next[index] = agree
    setAnswers(next)
    if (wasUnset && index + 1 < MBTI_QUESTIONS.length) {
      scrollToQuestionCard(questionRefs.current[index + 1])
    }
  }

  const restart = () => {
    saveSig.current = null
    setAnswers(MBTI_QUESTIONS.map(() => null))
  }

  if (done && type) {
    const titleKey = `test_mbti_type_${type}`
    const blurb = t(titleKey)
    const desc = blurb === titleKey ? t('test_mbti_type_default') : blurb
    return (
      <div className="tests-run tests-run--result">
        <div className="tests-result-hero tests-result-hero--mbti">
          <div className="tests-result-hero__glow" aria-hidden />
          <h1 className="tests-result-hero__title">{t('tests_mbti_result_title')}</h1>
          <p className="tests-mbti-type">{type}</p>
          <p className="tests-result-hero__sub tests-mbti-blurb">{desc}</p>
        </div>

        {axisCounts && (
          <section className="tests-mbti-axes" aria-labelledby="mbti-axes-heading">
            <h2 id="mbti-axes-heading" className="tests-mbti-axes__title">
              {t('tests_mbti_axes_title')}
            </h2>
            <p className="tests-mbti-axes__lead">{t('tests_mbti_axes_lead')}</p>
            <ul className="tests-mbti-axes__list">
              {MBTI_AXIS_ROWS.map((row) => {
                const { aPct, bPct, ca, cb } = axisSplit(axisCounts, row.a, row.b)
                return (
                  <li key={row.titleKey} className="tests-mbti-axis">
                    <div className="tests-mbti-axis__head">
                      <span className="tests-mbti-axis__name">{t(row.titleKey)}</span>
                    </div>
                    <div className="tests-mbti-axis__track" role="presentation">
                      <div
                        className="tests-mbti-axis__fill tests-mbti-axis__fill--a"
                        style={{ width: `${aPct}%` }}
                      />
                      <div
                        className="tests-mbti-axis__fill tests-mbti-axis__fill--b"
                        style={{ width: `${bPct}%` }}
                      />
                    </div>
                    <div className="tests-mbti-axis__labels">
                      <span
                        className={`tests-mbti-axis__pole ${aPct > bPct ? 'tests-mbti-axis__pole--lead' : ''}`}
                      >
                        {row.a}{' '}
                        <span className="tests-mbti-axis__pct">
                          {aPct}% ({ca}/4)
                        </span>
                      </span>
                      <span
                        className={`tests-mbti-axis__pole tests-mbti-axis__pole--end ${bPct > aPct ? 'tests-mbti-axis__pole--lead' : ''}`}
                      >
                        {row.b}{' '}
                        <span className="tests-mbti-axis__pct">
                          {bPct}% ({cb}/4)
                        </span>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="tests-mbti-next" aria-labelledby="mbti-next-heading">
          <h2 id="mbti-next-heading" className="tests-mbti-next__title">
            {t('tests_mbti_next_title')}
          </h2>
          <ul className="tests-mbti-next__list">
            <li>{t('tests_mbti_next_1')}</li>
            <li>{t('tests_mbti_next_2')}</li>
            <li>{t('tests_mbti_next_3')}</li>
          </ul>
        </section>

        {mbtiRecent.length > 0 && (
          <section className="tests-mbti-recent" aria-labelledby="mbti-recent-heading">
            <h2 id="mbti-recent-heading" className="tests-mbti-recent__title">
              {t('tests_mbti_recent_title')}
            </h2>
            <p className="tests-mbti-recent__scope">{t('tests_mbti_recent_scope')}</p>
            <ul className="tests-mbti-recent__list">
              {mbtiRecent.map((h) => (
                <li key={h.id} className="tests-mbti-recent__item">
                  <span className="tests-mbti-recent__type">{h.summary}</span>
                  <time className="tests-mbti-recent__when" dateTime={h.completedAt}>
                    {formatTestCompletedAt(h.completedAt, s.lang)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="tests-mbti-disclaimer">{t('tests_mbti_disclaimer')}</p>
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
            .replace('{t}', String(MBTI_QUESTIONS.length))}
        </p>
      </div>
      <h1 className="page-title tests-run__page-title">{t('tests_mbti_title')}</h1>
      <p className="tests-run__intro">{t('tests_mbti_how')}</p>
      <TestsProgressBar completed={answeredCount} total={MBTI_QUESTIONS.length} />
      <div className="tests-questions-stack">
        {MBTI_QUESTIONS.map((q, i) => (
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[i] = el
            }}
            className="tests-question tests-question--card tests-question--in-stack"
          >
            <p className="tests-question__text">{t(q.promptKey)}</p>
            <div className="tests-options tests-options--two">
              <button
                type="button"
                className={`tests-option ${answers[i] === true ? 'tests-option--selected' : ''}`}
                aria-pressed={answers[i] === true}
                onClick={() => setAnswer(i, true)}
              >
                {t('test_mbti_agree')}
              </button>
              <button
                type="button"
                className={`tests-option ${answers[i] === false ? 'tests-option--selected' : ''}`}
                aria-pressed={answers[i] === false}
                onClick={() => setAnswer(i, false)}
              >
                {t('test_mbti_disagree')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
