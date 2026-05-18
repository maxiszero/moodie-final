import type { MoodGradientMode } from '../types'

export const storageKeys = {
  token: 'moodie_token',
  username: 'moodie_user',
  userId: 'moodie_userId',
  role: 'moodie_role',
  lang: 'moodie_lang',
  theme: 'moodie_theme',
  /** vivid | pastel | auto — см. MoodGradientMode */
  moodGradientMode: 'moodie_mood_gradient_mode',
  currentEmotion: 'moodie_currentEmotion',
  currentEmoji: 'moodie_currentEmoji',
  currentColor: 'moodie_currentColor',
  currentColor2: 'moodie_currentColor2',
  currentColor3: 'moodie_currentColor3',
  welcomeSeen: 'moodie_welcome_seen',
  hasSeenOnboarding: 'hasSeenOnboarding',
  onboardingMood: 'moodie_onboarding_mood',
  onboardingEmoji: 'moodie_onboarding_emoji',
  onboardingColor: 'moodie_onboarding_color',
  onboardingColor2: 'moodie_onboarding_color2',
  onboardingColor3: 'moodie_onboarding_color3',
  justRegistered: 'moodie_just_registered',
  gettingStartedSeen: 'moodie_getting_started_seen',
  gettingStartedProgress: 'moodie_getting_started_progress',
  gettingStartedRewardClaimed: 'moodie_getting_started_reward_claimed',
  /** '1' if user wants browser notifications for the daily question */
  dailyNotifyEnabled: 'moodie_daily_notify_enabled',
  /** Last dayKey we showed a browser notification for (avoid duplicates) */
  dailyNotifyLastDay: 'moodie_daily_notify_last_day',
  /** '1' when Moodie account is linked to Telegram */
  telegramLinked: 'moodie_telegram_linked',
  /** Recent search queries (JSON string[]) */
  searchHistory: 'moodie_search_history',
  /** Composer draft on feed */
  postDraft: 'moodie_post_draft',
  dailyAnswerDraft: 'moodie_daily_answer_draft',
  /** In-app notification history (JSON) */
  notificationHistory: 'moodie_notification_history',
  /** Browser notifications for activity (follow, comment, reaction) */
  activityNotifyEnabled: 'moodie_activity_notify_enabled',
  /** Telegram Mini App onboarding seen */
  hasSeenTelegramOnboarding: 'moodie_tg_onboarding_seen',
} as const

export type Theme = 'light' | 'dark'
export type Lang = 'ru' | 'en'

export function getStoredMoodGradientMode(): MoodGradientMode {
  try {
    const v = localStorage.getItem(storageKeys.moodGradientMode)
    if (v === 'vivid' || v === 'pastel' || v === 'auto') return v
  } catch {
    /* ignore */
  }
  return 'auto'
}

export function setStoredMoodGradientMode(mode: MoodGradientMode) {
  try {
    localStorage.setItem(storageKeys.moodGradientMode, mode)
  } catch {
    /* ignore */
  }
}

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(storageKeys.theme)
  return v === 'dark' ? 'dark' : 'light'
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(storageKeys.theme, theme)
}

export function getStoredLang(): Lang {
  const v = localStorage.getItem(storageKeys.lang)
  return v === 'en' ? 'en' : 'ru'
}

export function setStoredLang(lang: Lang) {
  localStorage.setItem(storageKeys.lang, lang)
}

export function getToken(): string | null {
  return localStorage.getItem(storageKeys.token)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(storageKeys.token, token)
  else localStorage.removeItem(storageKeys.token)
}
