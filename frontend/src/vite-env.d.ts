/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  /** Bot username without @. Used to open Telegram from regular browsers. */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
  /** Optional Mini App short name from BotFather for t.me/<bot>/<app>?startapp=... links. */
  readonly VITE_TELEGRAM_MINI_APP_NAME?: string
  /** 1 = first 1FIT promo link, 2 = second (RA04LS). Overrides fit-reward-slot.json */
  readonly VITE_1FIT_REWARD_SLOT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
