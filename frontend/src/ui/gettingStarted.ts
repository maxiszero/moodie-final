import { storageKeys } from '../config/storage'

export type GettingStartedTaskId = 'first_post' | 'first_reaction' | 'first_follow' | 'open_profile'

export type GettingStartedProgress = Record<GettingStartedTaskId, boolean>

/** Ordered checklist — total count for progress UI must match this list. */
export const GETTING_STARTED_TASK_IDS: readonly GettingStartedTaskId[] = [
  'first_post',
  'first_reaction',
  'first_follow',
  'open_profile',
] as const

export const GETTING_STARTED_TASK_TOTAL = GETTING_STARTED_TASK_IDS.length

const DEFAULT_PROGRESS: GettingStartedProgress = {
  first_post: false,
  first_reaction: false,
  first_follow: false,
  open_profile: false,
}

export function loadGettingStartedProgress(): GettingStartedProgress {
  const raw = localStorage.getItem(storageKeys.gettingStartedProgress)
  if (!raw) return { ...DEFAULT_PROGRESS }
  try {
    const x = JSON.parse(raw) as Record<string, unknown>
    const migrated = {
      first_post: Boolean(x.first_post),
      first_reaction: Boolean(x.first_reaction),
      first_follow: Boolean(x.first_follow),
      open_profile: Boolean(x.open_profile ?? x.open_settings),
    }
    return { ...DEFAULT_PROGRESS, ...migrated }
  } catch {
    return { ...DEFAULT_PROGRESS }
  }
}

export function setGettingStartedTaskDone(id: GettingStartedTaskId) {
  const cur = loadGettingStartedProgress()
  if (cur[id]) return
  const next = { ...cur, [id]: true }
  localStorage.setItem(storageKeys.gettingStartedProgress, JSON.stringify(next))
}

export function isGettingStartedComplete(p: GettingStartedProgress) {
  return GETTING_STARTED_TASK_IDS.every((id) => p[id])
}

