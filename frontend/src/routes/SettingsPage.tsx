import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, type ApiError } from '../api/apiClient'
import { useSession } from '../state/SessionContext'
import type { Lang, TelegramSettings, Theme } from '../types'
import { t } from '../i18n/i18n'
import {
  getDailyNotifyEnabled,
  requestDailyNotifyPermission,
  setDailyNotifyEnabled,
} from '../ui/dailyNotifications'
import { isTelegramMiniApp } from '../telegram/webApp'

export function SettingsPage() {
  const s = useSession()
  const nav = useNavigate()
  const [msg, setMsg] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [dailyNotify, setDailyNotify] = useState(() => getDailyNotifyEnabled())
  const [dailyNotifyHint, setDailyNotifyHint] = useState<'granted' | 'denied' | null>(null)
  const [tgBusy, setTgBusy] = useState(false)
  const [tgMsg, setTgMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [tgSettings, setTgSettings] = useState<TelegramSettings | null>(null)
  const [tgSettingsSaving, setTgSettingsSaving] = useState(false)

  useEffect(() => {
    if (!s.isAuthed) return
    let alive = true
    apiFetch<TelegramSettings>('/users/me/telegram-settings')
      .then((next) => {
        if (alive) setTgSettings(next)
      })
      .catch(() => {
        /* optional */
      })
    return () => {
      alive = false
    }
  }, [s.isAuthed, s.telegramLinked])

  const persist = async (preferredLanguage: Lang, preferredTheme: Theme) => {
    setMsg('')
    try {
      await apiFetch<{ preferredLanguage: Lang; preferredTheme: Theme }>('/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage, preferredTheme }),
      })
      s.setLang(preferredLanguage)
      s.setTheme(preferredTheme)
      setMsg(t('saved'))
      setTimeout(() => setMsg(''), 2000)
    } catch {
      /* api error */
    }
  }

  const savePassword = async () => {
    setPwdMsg(null)
    if (newPassword !== confirmPassword) {
      setPwdMsg({ kind: 'err', text: t('settings_password_mismatch') })
      return
    }
    setPwdSaving(true)
    try {
      await apiFetch('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwdMsg({ kind: 'ok', text: t('settings_password_saved') })
      setTimeout(() => setPwdMsg(null), 2500)
    } catch (e) {
      const m = (e as ApiError).message || t('settings_save_error')
      setPwdMsg({ kind: 'err', text: m })
    } finally {
      setPwdSaving(false)
    }
  }

  const patchTelegramSettings = async (patch: Partial<TelegramSettings>) => {
    if (!tgSettings) return
    const optimistic = { ...tgSettings, ...patch, telegramTimezoneOffsetMinutes: new Date().getTimezoneOffset() }
    setTgSettings(optimistic)
    setTgSettingsSaving(true)
    setTgMsg(null)
    try {
      const next = await apiFetch<TelegramSettings>('/users/me/telegram-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          ...patch,
          telegramTimezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      })
      setTgSettings(next)
      setTgMsg({ kind: 'ok', text: t('settings_tg_notify_saved') })
    } catch (e) {
      setTgSettings(tgSettings)
      setTgMsg({ kind: 'err', text: (e as ApiError).message || t('settings_save_error') })
    } finally {
      setTgSettingsSaving(false)
    }
  }

  return (
    <div id="settingsView">
      <div className="back-row">
        <button type="button" id="settingsBackBtn" onClick={() => nav(-1)}>
          {t('back')}
        </button>
      </div>
      <h1 className="page-title" id="settingsPageTitle">
        {t('settings_title')}
      </h1>

      {s.isAuthed ? (
        <div className="settings-card">
          <h3>{t('settings_password_title')}</h3>
          <div className="settings-field">
            <label htmlFor="settingsCurrentPwd">{t('settings_password_current')}</label>
            <input
              id="settingsCurrentPwd"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label htmlFor="settingsNewPwd">{t('settings_password_new')}</label>
            <input
              id="settingsNewPwd"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label htmlFor="settingsConfirmPwd">{t('settings_password_confirm')}</label>
            <input
              id="settingsConfirmPwd"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="auth-btn"
            disabled={pwdSaving}
            onClick={() => void savePassword()}
          >
            {pwdSaving ? t('settings_password_saving') : t('settings_password_save')}
          </button>
          {pwdMsg ? (
            <p className={`settings-inline-msg ${pwdMsg.kind === 'ok' ? 'ok' : 'err'}`}>{pwdMsg.text}</p>
          ) : null}
        </div>
      ) : null}

      {s.isAuthed ? (
        <div className="settings-card">
          <h3>{t('settings_tg_title')}</h3>
          <p className="settings-hint">{t('settings_tg_desc')}</p>
          {s.telegramLinked ? (
            <p className="settings-inline-msg ok" style={{ marginTop: 8 }}>
              {t('settings_tg_linked')}
            </p>
          ) : null}
          {!s.telegramLinked && isTelegramMiniApp() ? (
            <button
              type="button"
              className="auth-btn"
              style={{ marginTop: 12, width: '100%' }}
              disabled={tgBusy}
              onClick={() => {
                setTgMsg(null)
                setTgBusy(true)
                void s
                  .linkTelegram()
                  .then(() => setTgMsg({ kind: 'ok', text: t('settings_tg_ok') }))
                  .catch((e: unknown) => {
                    const err = e as ApiError
                    let text = t('settings_tg_err')
                    if (err.status === 503) text = t('settings_tg_server')
                    else if (err.status === 409) text = t('settings_tg_already_other')
                    else if (err.message) text = err.message
                    setTgMsg({ kind: 'err', text })
                  })
                  .finally(() => setTgBusy(false))
              }}
            >
              {tgBusy ? t('settings_tg_linking') : t('settings_tg_link')}
            </button>
          ) : null}
          {!s.telegramLinked && !isTelegramMiniApp() ? (
            <p className="settings-hint" style={{ marginTop: 12 }}>
              {t('settings_tg_mini_only')}
            </p>
          ) : null}
          {s.telegramLinked ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 12, width: '100%' }}
              disabled={tgBusy}
              onClick={() => {
                setTgMsg(null)
                setTgBusy(true)
                void s
                  .unlinkTelegram()
                  .then(() => setTgMsg({ kind: 'ok', text: t('settings_tg_unlink_ok') }))
                  .catch(() => setTgMsg({ kind: 'err', text: t('settings_tg_err') }))
                  .finally(() => setTgBusy(false))
              }}
            >
              {t('settings_tg_unlink')}
            </button>
          ) : null}
          {tgMsg ? (
            <p className={`settings-inline-msg ${tgMsg.kind === 'ok' ? 'ok' : 'err'}`}>{tgMsg.text}</p>
          ) : null}
          {s.telegramLinked && tgSettings ? (
            <div className="settings-tg-panel">
              <label className="settings-option">
                <input
                  type="checkbox"
                  checked={tgSettings.telegramDailyNotify}
                  disabled={tgSettingsSaving}
                  onChange={(e) => void patchTelegramSettings({ telegramDailyNotify: e.target.checked })}
                />
                <span>{t('settings_tg_daily_toggle')}</span>
              </label>
              <label className="settings-option">
                <input
                  type="checkbox"
                  checked={tgSettings.telegramActivityNotify}
                  disabled={tgSettingsSaving}
                  onChange={(e) => void patchTelegramSettings({ telegramActivityNotify: e.target.checked })}
                />
                <span>{t('settings_tg_activity_toggle')}</span>
              </label>
              <div className="settings-field">
                <label htmlFor="tgDailyHour">{t('settings_tg_daily_hour')}</label>
                <select
                  id="tgDailyHour"
                  className="settings-select"
                  value={tgSettings.telegramDailyNotifyHour}
                  disabled={tgSettingsSaving}
                  onChange={(e) => void patchTelegramSettings({ telegramDailyNotifyHour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
              <label className="settings-option">
                <input
                  type="checkbox"
                  checked={tgSettings.telegramQuietHoursEnabled}
                  disabled={tgSettingsSaving}
                  onChange={(e) => void patchTelegramSettings({ telegramQuietHoursEnabled: e.target.checked })}
                />
                <span>{t('settings_tg_quiet_toggle')}</span>
              </label>
              <div className="settings-quiet-row">
                <div className="settings-field">
                  <label htmlFor="tgQuietStart">{t('settings_tg_quiet_from')}</label>
                  <select
                    id="tgQuietStart"
                    className="settings-select"
                    value={tgSettings.telegramQuietStartHour}
                    disabled={tgSettingsSaving || !tgSettings.telegramQuietHoursEnabled}
                    onChange={(e) => void patchTelegramSettings({ telegramQuietStartHour: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label htmlFor="tgQuietEnd">{t('settings_tg_quiet_to')}</label>
                  <select
                    id="tgQuietEnd"
                    className="settings-select"
                    value={tgSettings.telegramQuietEndHour}
                    disabled={tgSettingsSaving || !tgSettings.telegramQuietHoursEnabled}
                    onChange={(e) => void patchTelegramSettings({ telegramQuietEndHour: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="settings-hint">{t('settings_tg_quiet_hint')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="settings-card">
        <h3 id="settingsLangTitle">{t('lang_title')}</h3>
        <select
          id="settingsLanguage"
          className="settings-select"
          aria-label="Language"
          value={s.lang}
          onChange={(e) => void persist(e.target.value === 'en' ? 'en' : 'ru', s.theme)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="settings-card">
        <h3>{t('settings_daily_notify_title')}</h3>
        <p className="settings-hint">{t('settings_daily_notify_desc')}</p>
        <label className="settings-option" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={dailyNotify}
            onChange={(e) => {
              const on = e.target.checked
              setDailyNotify(on)
              setDailyNotifyEnabled(on)
              if (!on) setDailyNotifyHint(null)
            }}
          />
          <span>{dailyNotify ? t('settings_daily_notify_disable') : t('settings_daily_notify_enable')}</span>
        </label>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 12, width: '100%' }}
          onClick={async () => {
            setDailyNotifyHint(null)
            const p = await requestDailyNotifyPermission()
            setDailyNotify(getDailyNotifyEnabled())
            if (p === 'denied') setDailyNotifyHint('denied')
            else if (p === 'granted') setDailyNotifyHint('granted')
          }}
        >
          {t('settings_daily_notify_test')}
        </button>
        {dailyNotifyHint === 'denied' ? (
          <p className="settings-inline-msg err">{t('settings_daily_notify_denied')}</p>
        ) : null}
        {dailyNotifyHint === 'granted' ? (
          <p className="settings-inline-msg ok">{t('settings_daily_notify_on')}</p>
        ) : null}
      </div>

      <div className="settings-card">
        <h3 id="settingsThemeTitle">{t('theme_title')}</h3>
        <label className="settings-option">
          <input
            type="radio"
            name="theme"
            value="light"
            id="themeLight"
            checked={s.theme === 'light'}
            onChange={() => void persist(s.lang, 'light')}
          />
          <span id="themeLightLabel">{t('theme_light')}</span>
        </label>
        <label className="settings-option">
          <input
            type="radio"
            name="theme"
            value="dark"
            id="themeDark"
            checked={s.theme === 'dark'}
            onChange={() => void persist(s.lang, 'dark')}
          />
          <span id="themeDarkLabel">{t('theme_dark')}</span>
        </label>
      </div>
      <div className="settings-card">
        <h3 id="settingsMoodGradientTitle">{t('settings_mood_gradient_title')}</h3>
        <p className="settings-hint">{t('settings_mood_gradient_hint')}</p>
        <label className="settings-option">
          <input
            type="radio"
            name="moodGradient"
            value="auto"
            checked={s.moodGradientMode === 'auto'}
            onChange={() => s.setMoodGradientMode('auto')}
          />
          <span>{t('settings_mood_gradient_auto')}</span>
        </label>
        <label className="settings-option">
          <input
            type="radio"
            name="moodGradient"
            value="vivid"
            checked={s.moodGradientMode === 'vivid'}
            onChange={() => s.setMoodGradientMode('vivid')}
          />
          <span>{t('settings_mood_gradient_vivid')}</span>
        </label>
        <label className="settings-option">
          <input
            type="radio"
            name="moodGradient"
            value="pastel"
            checked={s.moodGradientMode === 'pastel'}
            onChange={() => s.setMoodGradientMode('pastel')}
          />
          <span>{t('settings_mood_gradient_pastel')}</span>
        </label>
      </div>
      <div className="settings-card">
        <button
          type="button"
          id="settingsLogoutBtn"
          className="auth-btn btn-danger"
          style={{ backgroundColor: 'var(--error-color)', border: 'none', width: '100%' }}
          onClick={() => {
            s.logout()
            nav('/', { replace: true })
          }}
        >
          {t('logout')}
        </button>
      </div>
      <p id="settingsSavedHint" className={`settings-hint ${msg ? '' : 'hidden'}`}>
        {msg}
      </p>
    </div>
  )
}
