import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { apiFetch, type ApiError } from '../api/apiClient'
import {
  getStoredLang,
  getStoredTheme,
  setStoredLang,
  setStoredTheme,
  setToken,
  storageKeys,
} from '../config/storage'
import type { AuthPayload, Lang, MePayload, Theme, UserMood } from '../types'
import { applyTheme } from '../ui/theme'
import { setLang } from '../i18n/i18n'
import { getTelegramWebApp } from '../telegram/webApp'

type SessionState = {
  token: string | null
  username: string | null
  userId: string | null
  role: 'user' | 'admin'
  telegramLinked: boolean
  lang: Lang
  theme: Theme
  mood: UserMood
}

type SessionContextValue = SessionState & {
  isAuthed: boolean
  setTheme: (theme: Theme) => void
  setLang: (lang: Lang) => void
  logout: () => void
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  refreshMe: () => Promise<void>
  linkTelegram: () => Promise<void>
  unlinkTelegram: () => Promise<void>
  lastAuthError: ApiError | null
}

const defaultMood: UserMood = {
  emotion: localStorage.getItem(storageKeys.currentEmotion) || 'neutral',
  emoji: localStorage.getItem(storageKeys.currentEmoji) || '😐',
  // Avoid dull gray defaults – use soft lavender palette until the backend provides real values.
  color: localStorage.getItem(storageKeys.currentColor) || '#C5CAE9',
  color2: localStorage.getItem(storageKeys.currentColor2) || '#E4D6F5',
  color3: localStorage.getItem(storageKeys.currentColor3) || '#C7B8EA',
}

function readTelegramLinked(): boolean {
  return localStorage.getItem(storageKeys.telegramLinked) === '1'
}

function loadInitialState(): SessionState {
  return {
    token: localStorage.getItem(storageKeys.token),
    username: localStorage.getItem(storageKeys.username),
    userId: localStorage.getItem(storageKeys.userId),
    role: (localStorage.getItem(storageKeys.role) as 'user' | 'admin') || 'user',
    telegramLinked: readTelegramLinked(),
    lang: getStoredLang(),
    theme: getStoredTheme(),
    mood: defaultMood,
  }
}

const Ctx = createContext<SessionContextValue | null>(null)

function applyAuthPayload(p: AuthPayload) {
  localStorage.setItem(storageKeys.username, p.username)
  localStorage.setItem(storageKeys.userId, p._id)
  localStorage.setItem(storageKeys.role, p.role || 'user')
  setToken(p.token)

  const mood: UserMood = {
    emotion: p.currentEmotion || 'neutral',
    emoji: p.currentEmoji || '😐',
    color: p.currentColor || '#9E9E9E',
    color2: p.currentColor2 || p.currentColor || '#757575',
    color3: p.currentColor3 || p.currentColor2 || p.currentColor || '#616161',
  }
  localStorage.setItem(storageKeys.currentEmotion, mood.emotion)
  localStorage.setItem(storageKeys.currentEmoji, mood.emoji)
  localStorage.setItem(storageKeys.currentColor, mood.color)
  localStorage.setItem(storageKeys.currentColor2, mood.color2)
  localStorage.setItem(storageKeys.currentColor3, mood.color3)

  if (p.preferredLanguage === 'ru' || p.preferredLanguage === 'en') {
    setStoredLang(p.preferredLanguage)
    setLang(p.preferredLanguage)
  }
  if (p.preferredTheme === 'light' || p.preferredTheme === 'dark') {
    setStoredTheme(p.preferredTheme)
    applyTheme(p.preferredTheme)
  }

  if (typeof p.telegramLinked === 'boolean') {
    localStorage.setItem(storageKeys.telegramLinked, p.telegramLinked ? '1' : '0')
  }

  return mood
}

function applyMePayload(p: MePayload) {
  localStorage.setItem(storageKeys.role, p.role || 'user')
  if (p.preferredLanguage === 'ru' || p.preferredLanguage === 'en') {
    setStoredLang(p.preferredLanguage)
    setLang(p.preferredLanguage)
  }
  if (p.preferredTheme === 'light' || p.preferredTheme === 'dark') {
    setStoredTheme(p.preferredTheme)
    applyTheme(p.preferredTheme)
  }

  const mood: UserMood = {
    emotion: p.currentEmotion || 'neutral',
    emoji: p.currentEmoji || '😐',
    color: p.currentColor || '#9E9E9E',
    color2: p.currentColor2 || '#757575',
    color3: p.currentColor3 || '#616161',
  }
  localStorage.setItem(storageKeys.currentEmotion, mood.emotion)
  localStorage.setItem(storageKeys.currentEmoji, mood.emoji)
  localStorage.setItem(storageKeys.currentColor, mood.color)
  localStorage.setItem(storageKeys.currentColor2, mood.color2)
  localStorage.setItem(storageKeys.currentColor3, mood.color3)

  if (typeof p.telegramLinked === 'boolean') {
    localStorage.setItem(storageKeys.telegramLinked, p.telegramLinked ? '1' : '0')
  }

  return mood
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(() => loadInitialState())
  const [lastAuthError, setLastAuthError] = useState<ApiError | null>(null)

  const logout = useCallback(() => {
    setLastAuthError(null)
    setToken(null)
    localStorage.removeItem(storageKeys.username)
    localStorage.removeItem(storageKeys.userId)
    localStorage.setItem(storageKeys.role, 'user')
    localStorage.removeItem(storageKeys.telegramLinked)
    setState((s) => ({
      ...s,
      token: null,
      username: null,
      userId: null,
      role: 'user',
      telegramLinked: false,
    }))
  }, [])

  const setTheme = useCallback((theme: Theme) => {
    setStoredTheme(theme)
    applyTheme(theme)
    setState((s) => ({ ...s, theme }))
  }, [])

  const setLangCb = useCallback((lang: Lang) => {
    setStoredLang(lang)
    setLang(lang)
    setState((s) => ({ ...s, lang }))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setLastAuthError(null)
    try {
      const p = await apiFetch<AuthPayload>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        auth: false,
      })
      const mood = applyAuthPayload(p)
      setState((s) => ({
        ...s,
        token: p.token,
        username: p.username,
        userId: p._id,
        role: p.role || 'user',
        telegramLinked: Boolean(p.telegramLinked),
        lang: (p.preferredLanguage as Lang) || s.lang,
        theme: (p.preferredTheme as Theme) || s.theme,
        mood,
      }))
    } catch (e) {
      setLastAuthError(e as ApiError)
      throw e
    }
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    setLastAuthError(null)
    try {
      const onboardingMood = localStorage.getItem(storageKeys.onboardingMood)
      const onboardingEmoji = localStorage.getItem(storageKeys.onboardingEmoji)
      const onboardingColor = localStorage.getItem(storageKeys.onboardingColor)
      const onboardingColor2 = localStorage.getItem(storageKeys.onboardingColor2)
      const onboardingColor3 = localStorage.getItem(storageKeys.onboardingColor3)

      const p = await apiFetch<AuthPayload>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          onboardingMood,
          onboardingEmoji,
          onboardingColor,
          onboardingColor2,
          onboardingColor3,
        }),
        auth: false,
      })
      const mood = applyAuthPayload(p)
      setState((s) => ({
        ...s,
        token: p.token,
        username: p.username,
        userId: p._id,
        role: p.role || 'user',
        telegramLinked: Boolean(p.telegramLinked),
        lang: (p.preferredLanguage as Lang) || s.lang,
        theme: (p.preferredTheme as Theme) || s.theme,
        mood,
      }))
    } catch (e) {
      setLastAuthError(e as ApiError)
      throw e
    }
  }, [])

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem(storageKeys.token)) return
    try {
      const me = await apiFetch<MePayload>('/auth/me')
      const mood = applyMePayload(me)
      setState((s) => ({
        ...s,
        role: me.role || 'user',
        telegramLinked: Boolean(me.telegramLinked),
        lang: (me.preferredLanguage as Lang) || s.lang,
        theme: (me.preferredTheme as Theme) || s.theme,
        mood,
      }))
    } catch (e) {
      const err = e as ApiError
      // If banned or token invalid, drop session.
      if (err.status === 401 || err.status === 403) logout()
    }
  }, [logout])

  const linkTelegram = useCallback(async () => {
    setLastAuthError(null)
    const initData = getTelegramWebApp()?.initData
    if (!initData?.trim()) {
      throw new Error('Telegram initData missing — open Moodie inside Telegram')
    }
    const me = await apiFetch<MePayload>('/auth/telegram/link', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    })
    const mood = applyMePayload(me)
    setState((s) => ({
      ...s,
      telegramLinked: Boolean(me.telegramLinked),
      mood,
    }))
  }, [])

  const unlinkTelegram = useCallback(async () => {
    setLastAuthError(null)
    const me = await apiFetch<MePayload>('/auth/telegram/unlink', { method: 'DELETE' })
    const mood = applyMePayload(me)
    setState((s) => ({
      ...s,
      telegramLinked: Boolean(me.telegramLinked),
      mood,
    }))
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      isAuthed: Boolean(state.token && state.username),
      setTheme,
      setLang: setLangCb,
      logout,
      login,
      register,
      refreshMe,
      linkTelegram,
      unlinkTelegram,
      lastAuthError,
    }),
    [lastAuthError, linkTelegram, login, logout, refreshMe, register, setLangCb, setTheme, state, unlinkTelegram],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used within SessionProvider')
  return v
}

