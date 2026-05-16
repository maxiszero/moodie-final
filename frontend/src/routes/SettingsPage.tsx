import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, type ApiError } from '../api/apiClient'
import { useSession } from '../state/SessionContext'
import type { Lang, Theme } from '../types'
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
