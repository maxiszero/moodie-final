import { storageKeys } from '../config/storage'
import type { Lang } from '../config/storage'

export type TestKind = 'emotions' | 'mbti' | 'stress'

export type TestHistoryEntry = {
  id: string
  kind: TestKind
  /** ISO 8601 */
  completedAt: string
  /** Short human-readable summary for lists */
  summary: string
  detail?: unknown
}

const MAX_ENTRIES = 50
const STORAGE_PREFIX = 'moodie_tests_history_v1_'

export function getTestHistoryStorageKey(): string {
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKeys.userId) : null
  return `${STORAGE_PREFIX}${uid || 'guest'}`
}

export function loadTestHistory(): TestHistoryEntry[] {
  try {
    const raw = localStorage.getItem(getTestHistoryStorageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw) as TestHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendTestHistory(entry: Omit<TestHistoryEntry, 'id'>): void {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const next = [{ id, ...entry }, ...loadTestHistory()].slice(0, MAX_ENTRIES)
  localStorage.setItem(getTestHistoryStorageKey(), JSON.stringify(next))
}

/** Format when the test was completed (local timezone). */
export function formatTestCompletedAt(iso: string, lang: Lang): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return iso
  }
}
