import type { MoodGradientMode, Theme } from '../types'
import { hexToRgb } from './moodShadow'

/** Resolved look: vivid = как в палитре; pastel = к белому; soft_dark = чуть ближе к фону тёмной темы */
export type EffectiveMoodStyle = 'vivid' | 'pastel' | 'soft_dark'

const PASTEL_TO_WHITE = 0.42
const SOFT_DARK_TO_BG = 0.27
const PASTEL_BG = '#ffffff'
const DARK_UI_BG = '#1a222c'

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(Math.max(0, Math.min(255, r)))}${h(Math.max(0, Math.min(255, g)))}${h(Math.max(0, Math.min(255, b)))}`
}

function mixHex(fg: string, bg: string, t: number): string {
  const A = hexToRgb(fg)
  const B = hexToRgb(bg)
  if (!A || !B) return fg
  const r = Math.round(A.r + (B.r - A.r) * t)
  const g = Math.round(A.g + (B.g - A.g) * t)
  const b = Math.round(A.b + (B.b - A.b) * t)
  return rgbToHex(r, g, b)
}

export function effectiveMoodStyle(mode: MoodGradientMode, theme: Theme): EffectiveMoodStyle {
  if (mode === 'vivid') return 'vivid'
  if (mode === 'pastel') return 'pastel'
  return theme === 'dark' ? 'soft_dark' : 'pastel'
}

export function applyMoodStyleToTriple(
  c1: string,
  c2: string,
  c3: string,
  style: EffectiveMoodStyle,
): [string, string, string] {
  if (style === 'vivid') return [c1, c2, c3]
  if (style === 'pastel') {
    return [
      mixHex(c1, PASTEL_BG, PASTEL_TO_WHITE),
      mixHex(c2, PASTEL_BG, PASTEL_TO_WHITE * 0.9),
      mixHex(c3, PASTEL_BG, PASTEL_TO_WHITE * 0.82),
    ]
  }
  return [
    mixHex(c1, DARK_UI_BG, SOFT_DARK_TO_BG),
    mixHex(c2, DARK_UI_BG, SOFT_DARK_TO_BG * 1.04),
    mixHex(c3, DARK_UI_BG, SOFT_DARK_TO_BG * 1.08),
  ]
}

export function moodLinearGradient135(
  c1: string,
  c2: string,
  c3: string,
  mode: MoodGradientMode,
  theme: Theme,
): string {
  const e = effectiveMoodStyle(mode, theme)
  const [a, b, c] = applyMoodStyleToTriple(c1, c2, c3, e)
  return `linear-gradient(135deg, ${a}, ${b}, ${c}, ${b}, ${a})`
}

export function moodBannerLinearGradient(
  c1: string,
  c2: string,
  c3: string,
  mode: MoodGradientMode,
  theme: Theme,
): string {
  const e = effectiveMoodStyle(mode, theme)
  const [a, b, c] = applyMoodStyleToTriple(c1, c2, c3, e)
  return `linear-gradient(110deg, ${a} 0%, ${b} 40%, ${c} 72%, ${a} 100%)`
}
