/** Shared motion tokens (Framer Motion + CSS). */
export const smoothEase = [0.22, 1, 0.36, 1] as const

export const pageTransition = {
  duration: 0.38,
  ease: smoothEase,
}

export const cardEnter = (delay = 0) => ({
  duration: 0.42,
  delay,
  ease: smoothEase,
})

export const springTap = { type: 'spring' as const, stiffness: 400, damping: 28 }
