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
  {
    emotion: 'neutral',
    emoji: '😐',
    phrase: 'Neutral',
    color1: '#E0E7FF',
    color2: '#A5B4FC',
    color3: '#6366F1',
    glow: '#818CF8',
  },
  {
    emotion: 'tired',
    emoji: '😫',
    phrase: 'Tired',
    color1: '#A5B4FC',
    color2: '#4F46E5',
    color3: '#312E81',
    glow: '#4F46E5',
  },
  {
    emotion: 'apathy',
    emoji: '😶',
    phrase: 'Apathy',
    color1: '#EDE9FE',
    color2: '#C4B5FD',
    color3: '#6D28D9',
    glow: '#9333EA',
  },
  {
    emotion: 'melancholy',
    emoji: '🌧️',
    phrase: 'Melancholy',
    color1: '#C7D2FE',
    color2: '#818CF8',
    color3: '#4338CA',
    glow: '#6366F1',
  },
  {
    emotion: 'inspiration',
    emoji: '✨',
    phrase: 'Inspired',
    color1: '#E9D5FF',
    color2: '#A855F7',
    color3: '#7E22CE',
    glow: '#A855F7',
  },
  {
    emotion: 'drive',
    emoji: '🚀',
    phrase: 'Drive',
    color1: '#FED7AA',
    color2: '#FB923C',
    color3: '#C2410C',
    glow: '#FB923C',
  },
  {
    emotion: 'excited',
    emoji: '🤩',
    phrase: 'Excited',
    color1: '#FEF08A',
    color2: '#FACC15',
    color3: '#CA8A04',
    glow: '#EAB308',
  },
  /** Legacy / alias keys sometimes stored before normalization */
  { emotion: 'inspired', emoji: '✨', phrase: 'Inspired', color1: '#E9D5FF', color2: '#A855F7', color3: '#7E22CE', glow: '#A855F7' },
  { emotion: 'driven', emoji: '🚀', phrase: 'Drive', color1: '#FED7AA', color2: '#FB923C', color3: '#C2410C', glow: '#FB923C' },
  { emotion: 'hyped', emoji: '🤩', phrase: 'Excited', color1: '#FEF08A', color2: '#FACC15', color3: '#CA8A04', glow: '#EAB308' },
]
