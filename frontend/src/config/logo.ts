function withBase(p: string) {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${p}`.replace(/\/{2,}/g, '/')
}

/** Файлы кладутся в `frontend/public/` */
export const LOGO_LIGHT = withBase('logo.png')
export const LOGO_DARK = withBase('logo-dark.png')
/** Только для шапки в тёмной теме (как в legacy index.html) */
export const LOGO_HEADER_DARK = withBase('dark-logo-head.png')

/** Fallback bundled SVG if png not present */
export const LOGO_FALLBACK = withBase('favicon.svg')
