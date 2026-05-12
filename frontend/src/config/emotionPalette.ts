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
    phrase: 'Радость',
    color1: '#FFE4C8',
    color2: '#FFF0DC',
    color3: '#FFF6EA',
    glow: '#E8A050',
  },
  {
    emotion: 'sad',
    emoji: '😢',
    phrase: 'Грусть',
    color1: '#D4E6EF',
    color2: '#C8DDE8',
    color3: '#BAD4E2',
    glow: '#6A9BAA',
  },
  {
    emotion: 'anxious',
    emoji: '😰',
    phrase: 'Тревога',
    color1: '#FFF2CC',
    color2: '#FFECC8',
    color3: '#FFE8BC',
    glow: '#D9A84A',
  },
  {
    emotion: 'calmness',
    emoji: '😌',
    phrase: 'Спокойствие',
    color1: '#D2EEE6',
    color2: '#C4E8DC',
    color3: '#B6E0D2',
    glow: '#4AAA8E',
  },
  {
    emotion: 'angry',
    emoji: '😠',
    phrase: 'Гнев',
    color1: '#FFD8D8',
    color2: '#FFCECE',
    color3: '#FFC4C4',
    glow: '#D07070',
  },
  {
    emotion: 'scared',
    emoji: '😨',
    phrase: 'Страх',
    color1: '#EAE4F4',
    color2: '#DFD6EE',
    color3: '#D4CAE6',
    glow: '#8B7CB8',
  },
  {
    emotion: 'loved',
    emoji: '🥰',
    phrase: 'Любовь',
    color1: '#FFE2EC',
    color2: '#FFD9E6',
    color3: '#F8D4EC',
    glow: '#D8789C',
  },
]
