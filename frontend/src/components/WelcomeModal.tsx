import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { storageKeys } from '../config/storage'

const easeOut = [0.22, 1, 0.36, 1] as const

const listContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
}

const listItem = {
  hidden: { opacity: 0, x: -14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.38, ease: easeOut },
  },
}

export function WelcomeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="welcome-overlay"
          id="welcomeModalOverlay"
          className="modal-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.22 }}
          onClick={onClose}
        >
          <motion.div
            className="welcome-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcomeTitle"
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: 'spring', stiffness: 320, damping: 28, mass: 0.85 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <motion.h2
              id="welcomeTitle"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.32, delay: reduce ? 0 : 0.06, ease: easeOut }}
            >
              Добро пожаловать в Moodie!
            </motion.h2>
            <motion.div id="welcomeFeatures" variants={listContainer} initial="hidden" animate="show">
              <motion.div className="welcome-feature" variants={listItem}>
                <motion.span
                  className="welcome-feature-icon"
                  aria-hidden
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
                >
                  ✨
                </motion.span>
                <div className="welcome-feature-text">
                  <b id="feat1Title">Выражайте эмоции</b>
                  <p id="feat1Desc">Делитесь своими чувствами в коротких постах до 228 символов.</p>
                </div>
              </motion.div>
              <motion.div className="welcome-feature" variants={listItem}>
                <motion.span
                  className="welcome-feature-icon"
                  aria-hidden
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    repeatDelay: 0.8,
                    ease: 'easeInOut',
                    delay: 0.25,
                  }}
                >
                  🤖
                </motion.span>
                <div className="welcome-feature-text">
                  <b id="feat2Title">ИИ-анализ</b>
                  <p id="feat2Desc">Наш ИИ подберёт идеальный цвет и эмодзи под ваше настроение.</p>
                </div>
              </motion.div>
              <motion.div className="welcome-feature" variants={listItem}>
                <motion.span
                  className="welcome-feature-icon"
                  aria-hidden
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    repeatDelay: 0.8,
                    ease: 'easeInOut',
                    delay: 0.5,
                  }}
                >
                  🫂
                </motion.span>
                <div className="welcome-feature-text">
                  <b id="feat3Title">Поддержка</b>
                  <p id="feat3Desc">Реагируйте и подписывайтесь, чтобы быть рядом.</p>
                </div>
              </motion.div>
            </motion.div>
            <motion.button
              id="welcomeCloseBtn"
              className="welcome-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : 0.45, ease: easeOut }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              onClick={() => {
                localStorage.setItem(storageKeys.welcomeSeen, 'true')
                onClose()
              }}
            >
              Понятно
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
