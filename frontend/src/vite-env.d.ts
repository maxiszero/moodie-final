/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  /** 1 = first 1FIT promo link, 2 = second (RA04LS). Overrides fit-reward-slot.json */
  readonly VITE_1FIT_REWARD_SLOT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
