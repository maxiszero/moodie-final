import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { storageKeys } from '../config/storage'
import {
  GETTING_STARTED_TASK_TOTAL,
  GETTING_STARTED_TASK_IDS,
  loadGettingStartedProgress,
  isGettingStartedComplete,
  setGettingStartedTaskDone,
  type GettingStartedProgress,
} from '../ui/gettingStarted'
import { t } from '../i18n/i18n'
import { GettingStartedTaskIcon } from './GettingStartedTaskIcon'
import { GettingStarted1fitPromo } from './GettingStarted1fitPromo'
import { getFitRewardUrl } from '../config/fitRewardUrl'
import { openTelegramMiniApp } from '../telegram/deepLink'

export function GettingStartedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion()
  const [progress, setProgress] = useState<GettingStartedProgress>(() => loadGettingStartedProgress())
  const [rewardClaimed, setRewardClaimed] = useState(() => Boolean(localStorage.getItem(storageKeys.gettingStartedRewardClaimed)))

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setProgress(loadGettingStartedProgress()), 400)
    return () => window.clearInterval(id)
  }, [open])

  const doneCount = useMemo(
    () => GETTING_STARTED_TASK_IDS.filter((id) => progress[id]).length,
    [progress],
  )
  const complete = isGettingStartedComplete(progress)
  const progressLabel = t('gs_progress').replace('{done}', String(doneCount)).replace('{total}', String(GETTING_STARTED_TASK_TOTAL))
  const tryTelegramBot = () => {
    if (openTelegramMiniApp()) {
      setGettingStartedTaskDone('add_to_home')
      setProgress(loadGettingStartedProgress())
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="getting-started-overlay"
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
      <motion.div
        className="welcome-modal getting-started-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 style={{ marginBottom: 8 }}>{t('gs_title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          {t('gs_modal_intro')} {progressLabel}
        </p>

        <GettingStarted1fitPromo />

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <TaskRow ok={progress.first_post} title={t('gs_task_first_post')} hint={t('gs_task_hint_first_post')} index={0} />
          <TaskRow ok={progress.first_reaction} title={t('gs_task_reaction')} hint={t('gs_task_hint_reaction')} index={1} />
          <TaskRow ok={progress.first_follow} title={t('gs_task_follow')} hint={t('gs_task_hint_follow')} index={2} />
          <TaskRow ok={progress.open_profile} title={t('gs_task_profile')} hint={t('gs_task_hint_profile')} index={3} />
          <TaskRow ok={progress.add_to_home} title={t('gs_task_a2hs')} hint={t('gs_task_hint_a2hs')} index={4} onClick={tryTelegramBot} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {complete && !rewardClaimed ? (
            <button
              type="button"
              className="welcome-btn"
              onClick={() => {
                localStorage.setItem(storageKeys.gettingStartedSeen, 'true')
                localStorage.removeItem(storageKeys.justRegistered)
                localStorage.setItem(storageKeys.gettingStartedRewardClaimed, 'true')
                setRewardClaimed(true)
                window.location.href = getFitRewardUrl()
              }}
              style={{ flex: 1 }}
            >
              {t('gs_reward')}
            </button>
          ) : (
            <button
              type="button"
              className="welcome-btn"
              onClick={() => {
                localStorage.setItem(storageKeys.gettingStartedSeen, 'true')
                localStorage.removeItem(storageKeys.justRegistered)
                onClose()
              }}
              style={{ flex: 1 }}
            >
              {t('gs_continue')}
            </button>
          )}
          {!complete ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                localStorage.setItem(storageKeys.gettingStartedSeen, 'true')
                localStorage.removeItem(storageKeys.justRegistered)
                onClose()
              }}
              style={{ padding: '10px 14px' }}
            >
              {t('gs_dismiss')}
            </button>
          ) : null}
        </div>
      </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function TaskRow({
  ok,
  title,
  hint,
  index,
  onClick,
}: {
  ok: boolean
  title: string
  hint: string
  index: number
  onClick?: () => void
}) {
  return (
    <motion.div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        background: 'rgba(255,255,255,0.02)',
        alignItems: 'flex-start',
        cursor: onClick ? 'pointer' : undefined,
      }}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: ok ? 0.75 : 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
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
      whileTap={onClick ? { scale: 0.99 } : undefined}
    >
      <div className="gs-modal-task-icon" style={{ flexShrink: 0, marginTop: 2 }}>
        <GettingStartedTaskIcon done={ok} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: 2 }}>{hint}</div>
      </div>
    </motion.div>
  )
}
