import { useEffect, useMemo, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { storageKeys } from '../config/storage'
import { ONBOARDING_EMOTION_CARDS } from '../config/emotionPalette'
import { LOGO_FALLBACK, LOGO_LIGHT } from '../config/logo'
import { apiFetch } from '../api/apiClient'
import type { Post } from '../types'
import { onboardingCardShadow } from '../ui/moodShadow'
import './Onboarding.css'

const cards = ONBOARDING_EMOTION_CARDS

const SWIPE_THRESHOLD = 88
const FLY_X = 460

function analyzeDominantMood(selected: string[]) {
  const freq = new Map<string, number>()
  selected.forEach((e) => freq.set(e, (freq.get(e) || 0) + 1))
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral'
  const card = cards.find((c) => c.emotion === top) || cards[0]
  return {
    emotion: card.emotion,
    emoji: card.emoji,
    phrase: card.phrase,
    color1: card.color1,
    color2: card.color2,
    color3: card.color3,
    glow: card.glow,
  }
}

type SwipeProps = {
  card: (typeof cards)[number]
  onSwipeComplete: (liked: boolean) => void
}

function SwipeableEmotionCard({ card, onSwipeComplete }: SwipeProps) {
  const x = useMotionValue(0)
  const [exiting, setExiting] = useState(false)

  const redOpacity = useTransform(x, (v) => (v < 0 ? Math.min(0.52, (-v / 240) * 0.52) : 0))
  const greenOpacity = useTransform(x, (v) => (v > 0 ? Math.min(0.52, (v / 240) * 0.52) : 0))

  const leftCueOpacity = useTransform(x, [-220, 0, 220], [1, 0.38, 0.32])
  const rightCueOpacity = useTransform(x, [-220, 0, 220], [0.32, 0.38, 1])
  const leftCueScale = useTransform(x, [-200, 0], [1.08, 1])
  const rightCueScale = useTransform(x, [0, 200], [1, 1.08])

  const rotate = useTransform(x, [-260, 260], [-10, 10])

  const runSwipe = async (liked: boolean) => {
    setExiting(true)
    const target = liked ? FLY_X : -FLY_X
    await animate(x, target, { type: 'spring', stiffness: 420, damping: 38, mass: 0.85 })
    onSwipeComplete(liked)
  }

  return (
    <motion.div
      className="onboarding-v2-card-wrap"
      style={{ x, rotate, boxShadow: onboardingCardShadow(card.glow) }}
      initial={{ opacity: 0, scale: 0.96, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }}
      drag={exiting ? false : 'x'}
      dragConstraints={{ left: -300, right: 300 }}
      dragElastic={0.12}
      onDragEnd={(_, info) => {
        if (exiting) return
        if (info.offset.x > SWIPE_THRESHOLD) void runSwipe(true)
        else if (info.offset.x < -SWIPE_THRESHOLD) void runSwipe(false)
        else void animate(x, 0, { type: 'spring', stiffness: 480, damping: 38 })
      }}
    >
      <div className="onboarding-v2-card-inner">
        <div
          className="onboarding-v2-gradient-bg"
          style={
            {
              ['--c1' as string]: card.color1,
              ['--c2' as string]: card.color2,
              ['--c3' as string]: card.color3,
            } as React.CSSProperties
          }
        />
        <motion.div className="onboarding-v2-overlay onboarding-v2-overlay--reject" style={{ opacity: redOpacity }} />
        <motion.div className="onboarding-v2-overlay onboarding-v2-overlay--accept" style={{ opacity: greenOpacity }} />
        <div className="onboarding-v2-emoji">{card.emoji}</div>
        <div className="onboarding-v2-phrase">{card.phrase}</div>
        <div className="onboarding-v2-cues">
          <motion.span
            className="onboarding-v2-cue onboarding-v2-cue--left"
            style={{ opacity: leftCueOpacity, scale: leftCueScale }}
          >
            Не я
          </motion.span>
          <motion.span
            className="onboarding-v2-cue onboarding-v2-cue--right"
            style={{ opacity: rightCueOpacity, scale: rightCueScale }}
          >
            Это про меня
          </motion.span>
        </div>
      </div>
    </motion.div>
  )
}

function OnboardingCardStack({
  remaining,
  index,
  setIndex,
  setSelected,
  setShowTransition,
}: {
  remaining: (typeof cards)[number][]
  index: number
  setIndex: React.Dispatch<React.SetStateAction<number>>
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  setShowTransition: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const top = remaining[0]
  if (!top) return null

  const behind = remaining.slice(1, 3)

  const advance = (liked: boolean) => {
    if (liked) setSelected((prev) => [...prev, top.emotion])
    setIndex((v) => {
      const next = v + 1
      if (next >= cards.length) setShowTransition(true)
      return next
    })
  }

  return (
    <div className="onboarding-v2-outer">
      <div className="onboarding-v2-stack">
        {behind.map((c, i) => (
          <div
            key={`${c.emotion}-behind-${index + i + 1}`}
            className="onboarding-v2-stack-behind"
            style={{
              zIndex: -1 - i,
              transform: `translateY(${(i + 1) * 16}px) scale(${1 - (i + 1) * 0.048}) rotate(${(i + 1) * -3}deg)`,
              boxShadow: onboardingCardShadow(c.glow),
            }}
          >
            <div
              className="onboarding-v2-stack-behind-inner onboarding-v2-gradient-bg"
              style={
                {
                  ['--c1' as string]: c.color1,
                  ['--c2' as string]: c.color2,
                  ['--c3' as string]: c.color3,
                } as React.CSSProperties
              }
            />
            <span className="onboarding-v2-stack-behind-emoji" aria-hidden>
              {c.emoji}
            </span>
          </div>
        ))}

        <SwipeableEmotionCard
          key={`${top.emotion}-${index}`}
          card={top}
          onSwipeComplete={(liked) => advance(liked)}
        />
      </div>

      <motion.div
        className="onboarding-v2-fallback-actions"
        aria-label="Действия без свайпа"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.button type="button" onClick={() => advance(false)} whileTap={{ scale: 0.97 }}>
          Не я
        </motion.button>
        <motion.button type="button" onClick={() => advance(true)} whileTap={{ scale: 0.97 }}>
          Это про меня
        </motion.button>
      </motion.div>
    </div>
  )
}

export function Onboarding({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [showTransition, setShowTransition] = useState(false)
  const [transitionShow, setTransitionShow] = useState(false)
  const [similar, setSimilar] = useState<Post[]>([])
  const [percentSame, setPercentSame] = useState<number | null>(null)

  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    document.body.classList.add('onboarding-active')
    return () => document.body.classList.remove('onboarding-active')
  }, [open])

  const remaining = useMemo(() => cards.slice(index), [index])
  const reduceMotion = useReducedMotion()

  if (!open) return null

  const dominant = analyzeDominantMood(selected)

  const headerEase = [0.22, 1, 0.36, 1] as const

  return (
    <>
      <motion.div
        id="onboardingScreen"
        className={`onboarding-screen onboarding-screen--v2 ${showTransition ? 'hidden' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: headerEase }}
      >
        <div className="onboarding-header onboarding-header--compact">
          <motion.img
            src={LOGO_LIGHT}
            alt="Moodie"
            className="onboarding-logo"
            width={60}
            height={60}
            initial={{ opacity: 0, scale: 0.88, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }
            }
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK
            }}
          />
          <motion.h1
            className="onboarding-title"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.12, ease: headerEase }}
          >
            Как ты себя чувствуешь сегодня?
          </motion.h1>
          <motion.p
            className="onboarding-subtitle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : 0.22, ease: headerEase }}
          >
            Выбери эмоции, которые тебе близки, свайпая карточки.
          </motion.p>
          {!reduceMotion ? (
            <motion.div
              className="onboarding-swipe-hint"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.35 }}
            >
              <motion.span
                className="onboarding-swipe-hint__arrow"
                animate={{ x: [0, -5, 0] }}
                transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
              >
                ←
              </motion.span>
              <span className="onboarding-swipe-hint__label">свайп</span>
              <motion.span
                className="onboarding-swipe-hint__arrow"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
              >
                →
              </motion.span>
            </motion.div>
          ) : null}
        </div>
        <OnboardingCardStack
          remaining={remaining}
          index={index}
          setIndex={setIndex}
          setSelected={setSelected}
          setShowTransition={setShowTransition}
        />
        <motion.div
          className="onboarding-controls"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.5, duration: reduceMotion ? 0 : 0.35 }}
        >
          <motion.button
            id="onboardingSkipBtn"
            type="button"
            className="onboarding-skip-btn"
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            onClick={() => {
              localStorage.setItem(storageKeys.hasSeenOnboarding, 'true')
              onDone()
            }}
          >
            Пропустить
          </motion.button>
        </motion.div>
      </motion.div>

      <div
        id="onboardingTransition"
        className={`onboarding-transition ${showTransition ? '' : 'hidden'} ${transitionShow ? 'show' : ''}`}
        style={
          {
            ['--color1' as string]: dominant.color1,
            ['--color2' as string]: dominant.color2,
            ['--color3' as string]: dominant.color3,
          } as React.CSSProperties
        }
      >
        <div className="onboarding-transition-content">
          <motion.h2
            className="onboarding-transition-text"
            style={{
              marginBottom: 20,
              color: '#172033',
              textShadow: '0 1px 0 rgba(255,255,255,0.9), 0 8px 22px rgba(15,23,42,0.22)',
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={transitionShow ? { opacity: 1, y: 0 } : { opacity: 0.85, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: headerEase }}
          >
            Мы поняли твое настроение...
          </motion.h2>

          {transitionShow ? (
            <motion.div
              id="onboardingResult"
              className="onboarding-result"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5, ease: headerEase }}
            >
              <motion.div
                className="onboarding-avatar-preview"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }
                }
              >
                <div
                  id="onboardingAvatar"
                  className="profile-avatar"
                  style={{
                    background: `linear-gradient(135deg, ${dominant.color1}, ${dominant.color2}, ${dominant.color3}, ${dominant.color2}, ${dominant.color1})`,
                  }}
                >
                  {dominant.emoji}
                </div>
                <p className="onboarding-avatar-label">
                  <span style={{ color: '#253047', opacity: 1 }}>
                    Твоя эмоция: <b style={{ color: '#111827' }}>{dominant.phrase}</b>
                  </span>
                </p>
              </motion.div>

              <motion.div
                className="onboarding-stats-row"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.12, duration: reduceMotion ? 0 : 0.4 }}
              >
                <div
                  className="onboarding-stat-card"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(15,23,42,0.14)',
                    color: '#172033',
                    boxShadow: '0 12px 28px rgba(15,23,42,0.14)',
                  }}
                >
                  <span id="onboardingPercent" className="stat-value" style={{ color: '#111827', textShadow: 'none' }}>
                    {(percentSame ?? 0).toString()}%
                  </span>
                  <span className="stat-label" style={{ color: '#3b465f', opacity: 1, textShadow: 'none' }}>
                    людей чувствуют то же самое
                  </span>
                </div>
              </motion.div>

              <motion.div
                className="onboarding-similar-posts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.2, duration: reduceMotion ? 0 : 0.4 }}
              >
                <p className="similar-posts-title" style={{ color: '#253047', opacity: 1 }}>
                  Посмотри, что пишут другие в этом настроении:
                </p>
                <div id="onboardingPostsList" className="similar-posts-list">
                  {similar.length ? (
                    similar.slice(0, 3).map((p, i) => (
                      <motion.div
                        key={p._id}
                        className="mini-post"
                        style={{
                          background: 'rgba(255,255,255,0.92)',
                          borderLeftColor: 'rgba(17,24,39,0.34)',
                          color: '#253047',
                          boxShadow: '0 8px 20px rgba(15,23,42,0.12)',
                          textShadow: 'none',
                        }}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: reduceMotion ? 0 : 0.28 + i * 0.08, duration: reduceMotion ? 0 : 0.35 }}
                      >
                        {p.text.length > 80 ? p.text.substring(0, 80) + '...' : p.text}
                      </motion.div>
                    ))
                  ) : (
                    <div
                      className="mini-post"
                      style={{
                        background: 'rgba(255,255,255,0.92)',
                        borderLeftColor: 'rgba(17,24,39,0.34)',
                        color: '#253047',
                        boxShadow: '0 8px 20px rgba(15,23,42,0.12)',
                        textShadow: 'none',
                      }}
                    >
                      Пока здесь пусто, стань первым!
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.button
                id="onboardingFinalBtn"
                type="button"
                className="auth-btn"
                style={{ marginTop: 30 }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.35, duration: reduceMotion ? 0 : 0.4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                onClick={() => {
                  localStorage.setItem(storageKeys.hasSeenOnboarding, 'true')
                  localStorage.setItem(storageKeys.onboardingMood, dominant.emotion)
                  localStorage.setItem(storageKeys.onboardingEmoji, dominant.emoji)
                  localStorage.setItem(storageKeys.onboardingColor, dominant.glow || dominant.color1)
                  localStorage.setItem(storageKeys.onboardingColor2, dominant.color2)
                  localStorage.setItem(storageKeys.onboardingColor3, dominant.color3)
                  onDone()
                  window.location.hash = '#/register'
                }}
              >
                Присоединиться к сообществу
              </motion.button>
            </motion.div>
          ) : null}
        </div>
      </div>

      {showTransition ? (
        <OnboardingEffects
          onShow={() => {
            setTimeout(() => setTransitionShow(true), 50)
            setTimeout(async () => {
              try {
                // 1) Stable percent based on actual mood stats
                const stats = await apiFetch<Array<{ _id: string; count: number }>>('/posts/stats/mood', { auth: false })
                const rows = Array.isArray(stats) ? stats : []
                const total = rows.reduce((acc, r) => acc + (typeof r?.count === 'number' ? r.count : 0), 0)
                const row = rows.find((r) => r?._id === dominant.emotion)
                const count = typeof row?.count === 'number' ? row.count : 0
                if (total > 0) {
                  const p = Math.round((count / total) * 100)
                  setPercentSame(Math.max(1, Math.min(99, p)))
                } else {
                  setPercentSame(0)
                }

                // 2) Latest posts with similar emotion
                const q = new URLSearchParams({
                  limit: '3',
                  sort: 'latest',
                  emotion: dominant.emotion,
                })
                const posts = await apiFetch<Post[]>(`/posts?${q.toString()}`, { auth: false })
                setSimilar(posts || [])
              } catch {
                setSimilar([])
                setPercentSame(0)
              }
            }, 1500)
          }}
        />
      ) : null}
    </>
  )
}

function OnboardingEffects({ onShow }: { onShow: () => void }) {
  useEffect(() => {
    onShow()
  }, [onShow])
  return null
}
