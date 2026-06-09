import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/legacy.css'
import './styles/motion-polish.css'
import './styles/toast.css'
import './styles/header-layout.css'
import './styles/feed-layout.css'
import './styles/feed-chrome.css'
import './styles/create-post.css'
import './styles/post-card.css'
import './styles/post-living.css'
import './styles/post-comments.css'
import './styles/onboarding-base.css'
import './styles/profile-layout.css'
import './styles/profile-history.css'
import './styles/admin-layout.css'
import './styles/getting-started-widget.css'
import './styles/mobile-layout.css'
import './styles/search-page.css'
import './styles/auth-layout.css'
import './styles/sidebar-widgets.css'
import App from './App.tsx'
import { initTheme } from './ui/theme'
import { initI18n } from './i18n/i18n'
import { SessionProvider } from './state/SessionContext'
import { RealtimeProvider } from './realtime/RealtimeContext'
import { initTelegramWebApp } from './telegram/webApp'
import { ToastProvider } from './ui/toastProvider'

initTheme()
initI18n()
initTelegramWebApp()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* ignore */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <ToastProvider>
        <RealtimeProvider>
          <App />
        </RealtimeProvider>
      </ToastProvider>
    </SessionProvider>
  </StrictMode>,
)
