import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/legacy.css'
import App from './App.tsx'
import { initTheme } from './ui/theme'
import { initI18n } from './i18n/i18n'
import { SessionProvider } from './state/SessionContext'
import { RealtimeProvider } from './realtime/RealtimeContext'
import { initTelegramWebApp } from './telegram/webApp'

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
      <RealtimeProvider>
        <App />
      </RealtimeProvider>
    </SessionProvider>
  </StrictMode>,
)
