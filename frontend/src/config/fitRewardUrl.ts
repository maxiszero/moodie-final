/**
 * 1FIT reward URLs. First code (QGWZRD) had a limited number of uses; second (RA04LS) is the follow-up.
 * Switch without redeploy: set `public/fit-reward-slot.json` to `{ "slot": 2 }`, or set `VITE_1FIT_REWARD_SLOT=2` in env.
 * Slot 1 = first link, slot 2 = second link. Default slot is 2 (RA04LS) after remote config is loaded; until then sync default is 2.
 */

const FIT_REWARD_URLS = [
  'https://1fit.app/mobile/promocode?text=QGWZRD&country=KZ',
  'https://1fit.app/mobile/promocode?text=RA04LS&country=KZ',
] as const

type Slot = 1 | 2

let remoteSlot: Slot | null = null
let prefetchDone = false

export async function prefetchFitRewardSlot(): Promise<void> {
  if (prefetchDone) return
  prefetchDone = true
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}fit-reward-slot.json`, { cache: 'no-store' })
    if (!r.ok) return
    const j = (await r.json()) as { slot?: number }
    if (j.slot === 1 || j.slot === 2) remoteSlot = j.slot
  } catch {
    /* offline / missing file — keep default */
  }
}

function envSlot(): Slot | null {
  const v = import.meta.env.VITE_1FIT_REWARD_SLOT
  if (v === '1' || v === '2') return Number(v) as Slot
  return null
}

function resolvedSlot(): Slot {
  const e = envSlot()
  if (e) return e
  if (remoteSlot) return remoteSlot
  return 2
}

/** Use after prefetch (or at click); sync resolution for immediate use. */
export function getFitRewardUrl(): string {
  const slot = resolvedSlot()
  return FIT_REWARD_URLS[slot - 1]
}
