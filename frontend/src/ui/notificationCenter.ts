import { storageKeys } from '../config/storage'
import type { AppNotification } from '../types'

export type StoredNotification = AppNotification & {
  id: string
  read: boolean
}

const MAX_ITEMS = 50

function loadRaw(): StoredNotification[] {
  try {
    const raw = localStorage.getItem(storageKeys.notificationHistory)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x) => x && typeof x === 'object' && typeof (x as StoredNotification).message === 'string') as StoredNotification[]
  } catch {
    return []
  }
}

function save(items: StoredNotification[]) {
  try {
    localStorage.setItem(storageKeys.notificationHistory, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* ignore */
  }
}

export function loadNotifications(): StoredNotification[] {
  return loadRaw()
}

export function unreadCount(): number {
  return loadRaw().filter((n) => !n.read).length
}

export function pushNotification(payload: AppNotification) {
  const id = `${payload.createdAt || Date.now()}:${payload.message.slice(0, 32)}`
  const items = loadRaw()
  if (items.some((n) => n.id === id)) return
  const next: StoredNotification = {
    ...payload,
    id,
    read: false,
  }
  save([next, ...items])
  window.dispatchEvent(new Event('moodie:notifications'))
}

export function markAllRead() {
  save(loadRaw().map((n) => ({ ...n, read: true })))
  window.dispatchEvent(new Event('moodie:notifications'))
}

export function markRead(id: string) {
  save(loadRaw().map((n) => (n.id === id ? { ...n, read: true } : n)))
  window.dispatchEvent(new Event('moodie:notifications'))
}

export function clearNotifications() {
  try {
    localStorage.removeItem(storageKeys.notificationHistory)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('moodie:notifications'))
}
