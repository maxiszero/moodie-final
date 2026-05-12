import { beforeEach, describe, expect, it } from 'vitest'
import { storageKeys } from '../config/storage'
import {
  GETTING_STARTED_TASK_TOTAL,
  isGettingStartedComplete,
  loadGettingStartedProgress,
  setGettingStartedTaskDone,
} from './gettingStarted'

describe('gettingStarted progress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads default progress when nothing is stored', () => {
    const progress = loadGettingStartedProgress()

    expect(Object.values(progress).filter(Boolean)).toHaveLength(0)
    expect(Object.keys(progress)).toHaveLength(GETTING_STARTED_TASK_TOTAL)
  })

  it('marks a task as done and persists it', () => {
    setGettingStartedTaskDone('first_post')

    const progress = loadGettingStartedProgress()

    expect(progress.first_post).toBe(true)
    expect(JSON.parse(localStorage.getItem(storageKeys.gettingStartedProgress) || '{}').first_post).toBe(true)
  })

  it('detects complete progress', () => {
    expect(
      isGettingStartedComplete({
        first_post: true,
        first_reaction: true,
        first_follow: true,
        open_profile: true,
        add_to_home: true,
      }),
    ).toBe(true)
  })
})
