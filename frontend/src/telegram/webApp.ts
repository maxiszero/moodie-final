type TelegramThemeParams = {
  bg_color?: string
  text_color?: string
  secondary_bg_color?: string
  button_color?: string
  button_text_color?: string
}

type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: unknown
  colorScheme?: 'light' | 'dark'
  themeParams?: TelegramThemeParams
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp || null
}

export function isTelegramMiniApp(): boolean {
  return Boolean(getTelegramWebApp()?.initData || getTelegramWebApp()?.initDataUnsafe)
}

export function initTelegramWebApp() {
  const app = getTelegramWebApp()
  if (!app) return

  document.body.classList.add('telegram-mini-app')
  if (app.colorScheme) {
    document.body.dataset.telegramTheme = app.colorScheme
  }

  app.ready?.()
  app.expand?.()

  const bg = app.themeParams?.bg_color || app.themeParams?.secondary_bg_color
  if (bg) {
    app.setBackgroundColor?.(bg)
    app.setHeaderColor?.(bg)
  }
}
