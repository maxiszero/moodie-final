import { storageKeys } from '../config/storage'

export function getDailyNotifyEnabled(): boolean {
  return localStorage.getItem(storageKeys.dailyNotifyEnabled) === '1'
}

export function setDailyNotifyEnabled(value: boolean) {
  localStorage.setItem(storageKeys.dailyNotifyEnabled, value ? '1' : '0')
}

/** Show at most one notification per calendar day (UTC) */
export function tryBrowserNotifyDaily(dayKey: string, title: string, body: string) {
  if (!getDailyNotifyEnabled()) return
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  const last = localStorage.getItem(storageKeys.dailyNotifyLastDay)
  if (last === dayKey) return
  localStorage.setItem(storageKeys.dailyNotifyLastDay, dayKey)
  try {
    new Notification(title, {
      body,
      tag: 'moodie-daily',
      renotify: true,
    } as NotificationOptions & { renotify?: boolean })
  } catch {
    /* ignore */
  }
}

export async function requestDailyNotifyPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  const p = await Notification.requestPermission()
  if (p === 'granted') setDailyNotifyEnabled(true)
  return p
}
