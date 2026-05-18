import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LOGO_FALLBACK, LOGO_LIGHT } from '../config/logo'
import { t } from '../i18n/i18n'
import { useRealtime } from '../realtime/RealtimeContext'
import { useSession } from '../state/SessionContext'
import { moodLinearGradient135 } from '../ui/moodGradientStyle'
import { HeaderSearch } from './HeaderSearch'
import { NotificationBell } from '../components/NotificationBell'

const homeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon mobile-only">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const settingsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export function AppHeader() {
  const rt = useRealtime()
  const s = useSession()
  const loc = useLocation()
  const guestLenta = loc.pathname === '/lenta'

  const onlineText =
    rt.onlineCount === null ? t('online_unknown') : t('online_count').replace('{n}', String(rt.onlineCount))

  const avatarGradient = useMemo(
    () => moodLinearGradient135(s.mood.color, s.mood.color2, s.mood.color3, s.moodGradientMode, s.theme),
    [s.mood.color, s.mood.color2, s.mood.color3, s.moodGradientMode, s.theme],
  )

  return (
    <header id="appHeader">
      <div className="header-content">
        <NavLink to="/" className="logo" id="logoLink">
          <img
            src={LOGO_LIGHT}
            alt="Moodie"
            className="logo-img-header"
            width={32}
            height={32}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK
            }}
          />
          Moodie
        </NavLink>
        <div className="header-search-slot">
          <HeaderSearch />
        </div>
        <nav className="nav-links">
          <div id="onlineStatus" className={`online-indicator ${rt.onlineCount !== null ? '' : 'hidden'}`}>
            <span className="online-dot" />
            <span id="onlineCountText">{onlineText}</span>
          </div>
          <NavLink end to="/" id="navHome" className={guestLenta ? 'hidden' : ''} title={t('nav_home')}>
            {homeIcon}
            <span className="desktop-only">{t('nav_home')}</span>
          </NavLink>
          <NavLink to="/tests" id="navTests" className={guestLenta ? 'hidden' : ''} title={t('nav_tests')}>
            <span className="desktop-only">{t('nav_tests')}</span>
          </NavLink>
          <NavLink to="/settings" id="navSettings" className={guestLenta ? 'hidden' : ''} title={t('nav_settings')}>
            {settingsIcon}
          </NavLink>
          {s.isAuthed ? <NotificationBell /> : null}
          {s.role === 'admin' ? (
            <NavLink to="/admin" id="navAdmin">
              {t('nav_admin')}
            </NavLink>
          ) : null}
          <div className={`header-profile ${guestLenta ? 'hidden' : ''}`}>
            <div
              className="user-circle user-circle--sm"
              id="headerUserCircle"
              title=""
              style={{
                cursor: 'pointer',
                background: avatarGradient,
              }}
              onClick={() => s.username && (window.location.hash = `#/profile/${encodeURIComponent(s.username)}`)}
            >
              {s.mood.emoji || '😐'}
            </div>
            <button
              type="button"
              id="userInfo"
              onClick={() => s.username && (window.location.hash = `#/profile/${encodeURIComponent(s.username)}`)}
            >
              {s.username ? `@${s.username}` : ''}
            </button>
          </div>
        </nav>
      </div>
    </header>
  )
}
