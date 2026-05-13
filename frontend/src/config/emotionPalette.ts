/**
 * Палитра эмоций для онбординга и подсказок: приглушённые пастели + тень через onboardingCardShadow.
 */
export type EmotionCardDef = {
  emotion: string
  emoji: string
  phrase: string
  color1: string
  color2: string
  color3: string
  /** Цвет для box-shadow (доминирующий оттенок эмоции) */
  glow: string
}

export const ONBOARDING_EMOTION_CARDS: EmotionCardDef[] = [
  {
    emotion: 'happy',
    emoji: '😊',
    phrase: 'Happy',
    color1: '#FFD166',
    color2: '#FFB703',
    color3: '#FB8500',
    glow: '#FFB703',
  },
  {
    emotion: 'sad',
    emoji: '😢',
    phrase: 'Sad',
    color1: '#BFDBFE',
    color2: '#60A5FA',
    color3: '#2563EB',
    glow: '#3B82F6',
  },
  {
    emotion: 'anxious',
    emoji: '😰',
    phrase: 'Anxious',
    color1: '#FEF3C7',
    color2: '#F59E0B',
    color3: '#EA580C',
    glow: '#F59E0B',
  },
  {
    emotion: 'calmness',
    emoji: '😌',
    phrase: 'Calmness',
    color1: '#CCFBF1',
    color2: '#2DD4BF',
    color3: '#059669',
    glow: '#14B8A6',
  },
  {
    emotion: 'angry',
    emoji: '😠',
    phrase: 'Angry',
    color1: '#FECACA',
    color2: '#EF4444',
    color3: '#B91C1C',
    glow: '#DC2626',
  },
  {
    emotion: 'scared',
    emoji: '😨',
    phrase: 'Scared',
    color1: '#DDD6FE',
    color2: '#8B5CF6',
    color3: '#4C1D95',
    glow: '#7C3AED',
  },
  {
    emotion: 'loved',
    emoji: '🥰',
    phrase: 'Loved',
    color1: '#FBCFE8',
    color2: '#EC4899',
    color3: '#BE185D',
    glow: '#DB2777',
  },
]
