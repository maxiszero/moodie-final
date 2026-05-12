import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { t } from '../i18n/i18n'
import { useFeedMood } from '../state/FeedMoodContext'
import { ONBOARDING_EMOTION_CARDS } from '../config/emotionPalette'

const TOP_N = 5

export function MoodStatsPanel() {
  const { stats } = useFeedMood()
  const topStats = useMemo(() => {
    return [...stats].sort((a, b) => b.count - a.count).slice(0, TOP_N)
  }, [stats])

  if (topStats.length === 0) {
    return <div id="moodStats" className="mood-stats-container hidden" />
  }

  const total = topStats.reduce((acc, s) => acc + s.count, 0)

  return (
    <div id="moodStats" className="mood-stats-container">
      <div className="mood-stats-title">{t('mood_stats_24h')}</div>
      <div className="mood-stats-list">
        {topStats.map((s, index) => (
          <MoodStatRow key={`${s._id}-${index}`} row={s} total={total} index={index} />
        ))}
      </div>
    </div>
  )
}

function MoodStatRow({
  row,
  total,
  index,
}: {
  row: { _id: string; count: number; emoji?: string; color?: string }
  total: number
  index: number
}) {
  const reduceMotion = useReducedMotion()
  const percent = total > 0 ? Math.round((row.count / total) * 100) : 0
  const pal = ONBOARDING_EMOTION_CARDS.find((c) => c.emotion === String(row._id).toLowerCase())
  const barColor = pal?.glow || row.color || 'var(--emotion-neutral)'
  const [reveal, setReveal] = useState(false)

  useEffect(() => {
    setReveal(false)
    const id = requestAnimationFrame(() => setReveal(true))
    return () => cancelAnimationFrame(id)
  }, [percent, row.count, row._id])

  const rowDur = reduceMotion ? 0 : 0.38
  const rowDelay = reduceMotion ? 0 : index * 0.07

  return (
    <motion.div
      className="mood-stat-item"
      title={`${row._id}: ${row.count}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: rowDur, delay: rowDelay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mood-stat-top">
        <span className="mood-stat-emoji">{row.emoji || '😐'}</span>
        <span className="mood-stat-name">{row._id}</span>
        <span className="mood-stat-percent">{percent}%</span>
      </div>
      <div className="mood-stat-bar">
        <div
          className="mood-stat-fill"
          style={{
            width: reveal ? `${percent}%` : '0%',
            background: barColor,
            transition: reduceMotion
              ? 'none'
              : 'width 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
          }}
        />
      </div>
    </motion.div>
  )
}
