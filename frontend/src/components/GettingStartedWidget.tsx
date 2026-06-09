import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GETTING_STARTED_TASK_TOTAL,
  loadGettingStartedProgress,
  isGettingStartedComplete,
  type GettingStartedProgress,
  type GettingStartedTaskId,
} from '../ui/gettingStarted'
import { t } from '../i18n/i18n'
import { GettingStartedTaskIcon } from './GettingStartedTaskIcon'

const TASK_COPY: Array<{ key: GettingStartedTaskId; i18n: string }> = [
  { key: 'first_post', i18n: 'gs_task_first_post' },
  { key: 'first_reaction', i18n: 'gs_task_reaction' },
  { key: 'first_follow', i18n: 'gs_task_follow' },
  { key: 'open_profile', i18n: 'gs_task_profile' },
]

export function GettingStartedWidget({ compactLink = false }: { compactLink?: boolean }) {
  const nav = useNavigate()
  const reduceMotion = useReducedMotion()
  const [progress, setProgress] = useState<GettingStartedProgress>(() => loadGettingStartedProgress())
  const [collapsed, setCollapsed] = useState(false)
  const dur = reduceMotion ? 0 : 0.35
  const stagger = reduceMotion ? 0 : 0.05

  useEffect(() => {
    const id = window.setInterval(() => setProgress(loadGettingStartedProgress()), 600)
    return () => window.clearInterval(id)
  }, [])

  const doneCount = useMemo(
    () => TASK_COPY.filter(({ key }) => progress[key]).length,
    [progress],
  )
  const complete = isGettingStartedComplete(progress)
  const progressLabel = t('gs_progress').replace('{done}', String(doneCount)).replace('{total}', String(GETTING_STARTED_TASK_TOTAL))

  if (compactLink) {
    return (
      <section
        className="gs-widget gs-widget--compact-link is-collapsed"
        aria-label={t('gs_title')}
        role="link"
        tabIndex={0}
        onClick={() => nav('/getting-started')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            nav('/getting-started')
          }
        }}
      >
        <div className="gs-widget__meta">{progressLabel}</div>
      </section>
    )
  }

  return (
    <section className={`gs-widget ${collapsed ? 'is-collapsed' : ''}`} aria-label={t('gs_title')}>
      <div className="gs-widget__head">
        <div className="gs-widget__title">{t('gs_title')}</div>
        <button type="button" className="gs-widget__toggle" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? t('gs_expand') : t('gs_collapse')}
        </button>
      </div>

      <div className="gs-widget__meta">{progressLabel}</div>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key="list"
            className="gs-widget__list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: dur, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {TASK_COPY.map(({ key, i18n }, i) => (
              <GsItem
                key={key}
                ok={progress[key]}
                text={t(i18n)}
                index={i}
                stagger={stagger}
                reduceMotion={reduceMotion}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {complete ? (
        <div className="gs-widget__meta" style={{ marginTop: 12 }}>
          {t('gs_complete')}
        </div>
      ) : null}
    </section>
  )
}

function GsItem({
  ok,
  text,
  index,
  stagger,
  reduceMotion,
  onClick,
}: {
  ok: boolean
  text: string
  index: number
  stagger: number
  reduceMotion: boolean | null
  onClick?: () => void
}) {
  const d = reduceMotion ? 0 : 0.32
  return (
    <motion.div
      className={`gs-item ${ok ? 'is-done' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: d, delay: reduceMotion ? 0 : index * stagger, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <motion.span
        className="gs-item__box"
        initial={false}
        animate={{ scale: ok && !reduceMotion ? [1, 1.12, 1] : 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
      >
        <GettingStartedTaskIcon done={ok} />
      </motion.span>
      <span className="gs-item__text">{text}</span>
    </motion.div>
  )
}
