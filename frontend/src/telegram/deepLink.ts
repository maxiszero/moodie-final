export function telegramMiniAppLink(): string {
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '')
  if (!bot) return ''

  const appName = import.meta.env.VITE_TELEGRAM_MINI_APP_NAME?.trim().replace(/^\/+|\/+$/g, '')
  const payload = 'login'
  if (appName) {
    return `https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(appName)}?startapp=${encodeURIComponent(payload)}`
  }
  return `https://t.me/${encodeURIComponent(bot)}?startapp=${encodeURIComponent(payload)}`
}

export function openTelegramMiniApp(): boolean {
  const url = telegramMiniAppLink()
  if (!url) return false
  window.location.assign(url)
  return true
}
