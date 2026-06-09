import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { smoothEase, springTap } from '../ui/motion'

type Props = {
  emoji: string
  label: string
  count?: number
  countClassName?: string
  active?: boolean
  disabled?: boolean
  className?: string
  onClick: () => void | Promise<void>
}

export function ReactionButton({
  emoji,
  label,
  count,
  countClassName = 'reaction-count',
  active = false,
  disabled = false,
  className = '',
  onClick,
}: Props) {
  const reduceMotion = useReducedMotion()
  const [burst, setBurst] = useState(false)

  const handleClick = async () => {
    if (!reduceMotion) {
      setBurst(true)
      window.setTimeout(() => setBurst(false), 520)
    }
    await onClick()
  }

  return (
    <motion.button
      type="button"
      className={`reaction-btn ${active ? 'active' : ''} ${className}`.trim()}
      disabled={disabled}
      onClick={() => void handleClick()}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.94 }}
      transition={springTap}
      layout={false}
    >
      <span className="reaction-btn__emoji-wrap">
        <motion.span
          className="reaction-btn__emoji"
          animate={active && !reduceMotion ? { scale: [1, 1.22, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: smoothEase }}
        >
          {emoji}
        </motion.span>
        <AnimatePresence>
          {burst ? (
            <motion.span
              className="reaction-burst"
              initial={{ opacity: 0.9, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -22, scale: 1.35 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: smoothEase }}
            >
              {emoji}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      <span>{label}</span>
      {count !== undefined ? (
        <motion.span
          key={count}
          className={countClassName}
          initial={reduceMotion ? false : { scale: 1.35, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.28, ease: smoothEase }}
        >
          {count}
        </motion.span>
      ) : null}
    </motion.button>
  )
}
