import { storageKeys } from './storage'

const MAX = 12

function parse(): string[] {
  try {
    const raw = localStorage.getItem(storageKeys.searchHistory)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    return j
      .filter((x) => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
  } catch {
    return []
  }
}

function persist(list: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const t = s.trim()
    if (t.length < 2 || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX) break
  }
  localStorage.setItem(storageKeys.searchHistory, JSON.stringify(out))
  return out
}

export function getSearchHistory(): string[] {
  return parse().slice(0, MAX)
}

/** Adds a query to the front; deduplicates; max 12 items. */
export function addSearchHistoryEntry(query: string): void {
  const t = query.trim()
  if (t.length < 2) return
  const rest = getSearchHistory().filter((x) => x !== t)
  persist([t, ...rest])
}

export function removeSearchHistoryEntry(query: string): void {
  const t = query.trim()
  const next = getSearchHistory().filter((x) => x !== t)
  persist(next)
}

export function clearSearchHistory(): void {
  localStorage.removeItem(storageKeys.searchHistory)
}
