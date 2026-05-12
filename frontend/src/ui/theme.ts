import { getStoredTheme, setStoredTheme, type Theme } from '../config/storage'
import { LOGO_DARK, LOGO_HEADER_DARK, LOGO_LIGHT } from '../config/logo'

export function applyTheme(theme: Theme) {
  const th: Theme = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', th)
  setStoredTheme(th)

  const logoForBlocks = th === 'dark' ? LOGO_DARK : LOGO_LIGHT
  const headerLogo = th === 'dark' ? LOGO_HEADER_DARK : LOGO_LIGHT

  document.querySelectorAll<HTMLImageElement>('.logo-img').forEach((img) => {
    img.src = logoForBlocks
  })
  document.querySelectorAll<HTMLImageElement>('.onboarding-logo').forEach((img) => {
    img.src = logoForBlocks
  })
  document.querySelectorAll<HTMLImageElement>('.logo-img-header').forEach((img) => {
    img.src = headerLogo
  })

  const favicon = document.getElementById('favicon') as HTMLLinkElement | null
  if (favicon) {
    favicon.href = logoForBlocks
    favicon.type = 'image/png'
  }
}

export function initTheme() {
  applyTheme(getStoredTheme())
}
