import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useSession } from '../state/SessionContext'
import { t } from '../i18n/i18n'

const iconSearch = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
)

const iconHome = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const iconGlobe = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const iconTests = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M9 11H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h4" />
    <path d="M15 7h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4" />
    <path d="M9 21V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v17" />
    <line x1="12" y1="7" x2="12" y2="11" />
  </svg>
)

const iconSteps = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M9 11l2 2 4-4" />
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
)

const iconUser = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const iconShield = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const iconSettings = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const iconUserPlus = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
)

function Tab({
  to,
  end,
  label,
  icon,
}: {
  to: string
  end?: boolean
  label: string
  icon: ReactNode
}) {
  const loc = useLocation()

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        const active = isActive && !(end && loc.search)
        return `app-mobile-nav__tab ${active ? 'active' : ''}`
      }}
      title={label}
    >
      <span className="app-mobile-nav__icon">{icon}</span>
      <span className="app-mobile-nav__label">{label}</span>
    </NavLink>
  )
}

export function AppMobileNav() {
  const s = useSession()

  return (
    <nav id="appMobileNav" className="app-mobile-nav" aria-label={t('nav_aria_mobile')}>
      <div className="app-mobile-nav__tabs">
        {s.isAuthed ? (
          <>
            <Tab to="/" end label={t('nav_home')} icon={iconHome} />
            <Tab to="/tests" label={t('nav_tests')} icon={iconTests} />
            <Tab to="/search" label={t('nav_search')} icon={iconSearch} />
            <Tab to="/getting-started" label={t('gs_nav_short')} icon={iconSteps} />
            <Tab to="/settings" label={t('nav_settings')} icon={iconSettings} />
            {s.username ? (
              <Tab to={`/profile/${encodeURIComponent(s.username)}`} label={t('nav_bottom_profile')} icon={iconUser} />
            ) : null}
            {s.role === 'admin' ? <Tab to="/admin" label={t('nav_admin')} icon={iconShield} /> : null}
          </>
        ) : (
          <>
            <Tab to="/" end label={t('nav_bottom_login')} icon={iconHome} />
            <Tab to="/lenta" label={t('nav_public_feed_short')} icon={iconGlobe} />
            <Tab to="/tests" label={t('nav_tests')} icon={iconTests} />
            <Tab to="/search" label={t('nav_search')} icon={iconSearch} />
            <Tab to="/settings" label={t('nav_settings')} icon={iconSettings} />
            <Tab to="/register" label={t('signup')} icon={iconUserPlus} />
          </>
        )}
      </div>
    </nav>
  )
}
