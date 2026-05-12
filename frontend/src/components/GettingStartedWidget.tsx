import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { storageKeys } from '../config/storage'
import {
  GETTING_STARTED_TASK_TOTAL,
  loadGettingStartedProgress,
  isGettingStartedComplete,
  type GettingStartedProgress,
  type GettingStartedTaskId,
} from '../ui/gettingStarted'
import { t } from '../i18n/i18n'
import { GettingStartedTaskIcon } from './GettingStartedTaskIcon'
import { GettingStarted1fitPromo } from './GettingStarted1fitPromo'
import { getFitRewardUrl } from '../config/fitRewardUrl'

const TASK_COPY: Array<{ key: GettingStartedTaskId; i18n: string }> = [
  { key: 'first_post', i18n: 'gs_task_first_post' },
  { key: 'first_reaction', i18n: 'gs_task_reaction' },
  { key: 'first_follow', i18n: 'gs_task_follow' },
  { key: 'open_profile', i18n: 'gs_task_profile' },
  { key: 'add_to_home', i18n: 'gs_task_a2hs' },
]

export function GettingStartedWidget() {
  const reduceMotion = useReducedMotion()
  const [progress, setProgress] = useState<GettingStartedProgress>(() => loadGettingStartedProgress())
  const [collapsed, setCollapsed] = useState(false)
  const [rewardClaimed, setRewardClaimed] = useState(() => Boolean(localStorage.getItem(storageKeys.gettingStartedRewardClaimed)))
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

  return (
    <section className={`gs-widget ${collapsed ? 'is-collapsed' : ''}`} aria-label={t('gs_title')}>
      <div className="gs-widget__head">
        <div className="gs-widget__title">{t('gs_title')}</div>
        <button type="button" className="gs-widget__toggle" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? t('gs_expand') : t('gs_collapse')}
        </button>
      </div>

      <div className="gs-widget__meta">{progressLabel}</div>

      <GettingStarted1fitPromo />

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
              <GsItem key={key} ok={progress[key]} text={t(i18n)} index={i} stagger={stagger} reduceMotion={reduceMotion} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {complete && !rewardClaimed ? (
        <motion.button
          type="button"
          className="auth-btn"
          style={{ width: '100%', marginTop: 12 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => {
            localStorage.setItem(storageKeys.gettingStartedSeen, 'true')
            localStorage.removeItem(storageKeys.justRegistered)
            localStorage.setItem(storageKeys.gettingStartedRewardClaimed, 'true')
            setRewardClaimed(true)
            window.location.href = getFitRewardUrl()
          }}
        >
          {t('gs_reward')}
        </motion.button>
      ) : complete && rewardClaimed ? (
        <div className="gs-widget__meta" style={{ marginTop: 12 }}>
          {t('gs_reward_claimed')}
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
}: {
  ok: boolean
  text: string
  index: number
  stagger: number
  reduceMotion: boolean | null
}) {
  const d = reduceMotion ? 0 : 0.32
  return (
    <motion.div
      className={`gs-item ${ok ? 'is-done' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: d, delay: reduceMotion ? 0 : index * stagger, ease: [0.22, 1, 0.36, 1] }}
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
