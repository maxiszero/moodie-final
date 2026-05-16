import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LOGO_FALLBACK, LOGO_LIGHT } from '../config/logo'
import type { ApiError } from '../api/apiClient'
import { useSession } from '../state/SessionContext'
import { t } from '../i18n/i18n'
import { storageKeys } from '../config/storage'
import { isTelegramMiniApp } from '../telegram/webApp'
import { useToast } from '../ui/toastProvider'

export function AuthPage() {
  const s = useSession()
  const nav = useNavigate()
  const loc = useLocation()
  const { showToast } = useToast()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showLoginPass, setShowLoginPass] = useState(false)
  const [showRegPass, setShowRegPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tgBusy, setTgBusy] = useState(false)

  const errText = useMemo(() => {
    if (!s.lastAuthError) return ''
    return s.lastAuthError.message || 'Auth failed'
  }, [s.lastAuthError])

  useEffect(() => {
    if (loc.pathname === '/register') setMode('register')
    else setMode('login')
  }, [loc.pathname])

  return (
    <>
      <div className="auth-hero" style={{ textAlign: 'center', marginTop: 60, marginBottom: -20 }}>
        <img
          src={LOGO_LIGHT}
          alt="Moodie"
          className="logo-img logo-img--large"
          width={64}
          height={64}
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK
          }}
        />
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            letterSpacing: '-0.05em',
            marginTop: 10,
            background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Moodie
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '1.1rem', fontWeight: 500 }}>{t('app_tagline')}</p>
      </div>

      <div id="loginForm" className={`auth-container ${mode === 'login' ? '' : 'hidden'}`}>
        <h2 className="text-center">{t('login_title')}</h2>
        <div className="form-group">
          <label htmlFor="loginUsername">{t('username')}</label>
          <input
            type="text"
            id="loginUsername"
            placeholder={t('ph_user')}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="loginPassword">{t('password')}</label>
          <div className="password-input-wrapper">
            <input
              type={showLoginPass ? 'text' : 'password'}
              id="loginPassword"
              placeholder={t('ph_pass')}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle-btn"
              title="Show password"
              onClick={() => setShowLoginPass((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
        <div id="loginError" className="error-message">
          {errText}
        </div>
        <button
          id="loginSubmitBtn"
          type="button"
          className="auth-btn"
          disabled={busy || !username.trim() || !password}
          onClick={async () => {
            setBusy(true)
            try {
              await s.login(username.trim(), password)
              nav('/', { replace: true })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? t('login_processing') : t('login_btn')}
        </button>

        {isTelegramMiniApp() ? (
          <button
            type="button"
            className="auth-btn btn-secondary auth-btn--telegram"
            disabled={tgBusy || busy}
            onClick={() => {
              setTgBusy(true)
              void (async () => {
                try {
                  await s.telegramLogin()
                  nav('/', { replace: true })
                } catch (e) {
                  const err = e as ApiError
                  if (err.status === 404) showToast(t('auth_tg_not_linked'))
                  else if (err.status === 503) showToast(t('settings_tg_server'))
                  else if (err.message) showToast(err.message)
                  else showToast(t('auth_tg_no_initdata'))
                } finally {
                  setTgBusy(false)
                }
              })()
            }}
          >
            {tgBusy ? t('auth_tg_busy') : t('auth_tg_login')}
          </button>
        ) : null}

        <div className="text-center auth-switch">
          {t('no_account')}{' '}
          <a id="showRegisterBtn" href="#/register" onClick={(e) => { e.preventDefault(); setMode('register') }}>
            {t('signup')}
          </a>
        </div>
        <div className="auth-author">
          By{' '}
          <a href="https://web.telegram.org/k/#@maxxxls" target="_blank" rel="noreferrer" className="author-link">
            @maxxxls
          </a>
        </div>
      </div>

      <div id="registerForm" className={`auth-container ${mode === 'register' ? '' : 'hidden'}`}>
        <h2 className="text-center">{t('register_title')}</h2>
        <div className="form-group">
          <label htmlFor="registerUsername">{t('username')}</label>
          <input
            type="text"
            id="registerUsername"
            placeholder={t('ph_new_user')}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="registerPassword">{t('password')}</label>
          <div className="password-input-wrapper">
            <input
              type={showRegPass ? 'text' : 'password'}
              id="registerPassword"
              placeholder={t('ph_new_pass')}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle-btn"
              title="Show password"
              onClick={() => setShowRegPass((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
        <div id="registerError" className="error-message">
          {errText}
        </div>
        <button
          id="registerSubmitBtn"
          type="button"
          className="auth-btn"
          disabled={busy || !username.trim() || !password}
          onClick={async () => {
            setBusy(true)
            try {
              await s.register(username.trim(), password)
              localStorage.setItem(storageKeys.justRegistered, 'true')
              nav('/', { replace: true })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? t('register_processing') : t('register_btn')}
        </button>

        {isTelegramMiniApp() ? (
          <button
            type="button"
            className="auth-btn btn-secondary auth-btn--telegram"
            disabled={tgBusy || busy}
            onClick={() => {
              setTgBusy(true)
              void (async () => {
                try {
                  await s.telegramLogin()
                  nav('/', { replace: true })
                } catch (e) {
                  const err = e as ApiError
                  if (err.status === 404) showToast(t('auth_tg_not_linked'))
                  else if (err.status === 503) showToast(t('settings_tg_server'))
                  else if (err.message) showToast(err.message)
                  else showToast(t('auth_tg_no_initdata'))
                } finally {
                  setTgBusy(false)
                }
              })()
            }}
          >
            {tgBusy ? t('auth_tg_busy') : t('auth_tg_login')}
          </button>
        ) : null}

        <div className="text-center auth-switch">
          {t('have_account')}{' '}
          <a id="showLoginBtn" href="#/" onClick={(e) => { e.preventDefault(); setMode('login') }}>
            {t('login_link')}
          </a>
        </div>
        <div className="auth-author">
          By{' '}
          <a href="https://web.telegram.org/k/#@maxxxls" target="_blank" rel="noreferrer" className="author-link">
            @maxxxls
          </a>
        </div>
      </div>
    </>
  )
}
