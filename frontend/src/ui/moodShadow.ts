/** Parse #RGB or #RRGGBB to rgb components */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (h.length !== 6) return null
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/**
 * Заметное мягкое свечение по цвету настроения (для карточек постов и онбординга).
 */
export function softMoodShadow(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return '0 4px 20px rgba(15, 23, 42, 0.12), 0 12px 40px rgba(15, 23, 42, 0.08)'
  }
  const { r, g, b } = rgb
  return [
    // Inspired by: 0px 0px 7px 10px, 0px 1px 20px, 0px 32px 64px, 0px 32px 64px, 0px 10px 32px
    // Note: rgba alpha in CSS must be within [0..1], so we approximate "1.28+" via layered glows.
    `0 0 7px 10px rgba(${r},${g},${b},0.62)`,
    `0 1px 20px rgba(${r},${g},${b},0.72)`,
    `0 32px 64px rgba(${r},${g},${b},0.62)`,
    `0 32px 64px rgba(${r},${g},${b},0.50)`,
    `0 10px 32px rgba(${r},${g},${b},0.46)`,
  ].join(', ')
}

/**
 * Мягкая цветная тень для онбординга — без сильного «неона», ближе к обычной глубине карточки.
 */
export function onboardingCardShadow(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return '0 8px 28px rgba(15, 23, 42, 0.1), 0 2px 10px rgba(15, 23, 42, 0.06)'
  }
  const { r, g, b } = rgb
  return [
    `0 2px 12px rgba(15, 23, 42, 0.07)`,
    `0 8px 28px rgba(${r},${g},${b},0.14)`,
    `0 20px 44px rgba(${r},${g},${b},0.1)`,
  ].join(', ')
}
