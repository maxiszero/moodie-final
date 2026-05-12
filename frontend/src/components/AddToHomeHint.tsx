import { useEffect, useMemo, useState } from 'react'
import { setGettingStartedTaskDone } from '../ui/gettingStarted'
import { t } from '../i18n/i18n'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
}

function isStandalone() {
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    // iOS Safari
    (navigator as any).standalone === true
  )
}

export function AddToHomeHint() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setGettingStartedTaskDone('add_to_home')
    }

    window.addEventListener('beforeinstallprompt', onBefore as any)
    window.addEventListener('appinstalled', onInstalled)

    // If already standalone (especially iOS), mark done.
    if (isStandalone()) {
      setGettingStartedTaskDone('add_to_home')
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore as any)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const ios = useMemo(() => isIOS(), [])

  if (installed) return null

  return (
    <div className="gs-a2hs">
      <div className="gs-a2hs__title">{t('a2hs_title')}</div>
      {deferred ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            try {
              await deferred.prompt()
              const c = await deferred.userChoice
              if (c.outcome === 'accepted') {
                // appinstalled will fire in many browsers; keep fallback.
                setTimeout(() => {
                  if (isStandalone()) setGettingStartedTaskDone('add_to_home')
                }, 1200)
              }
            } finally {
              setDeferred(null)
            }
          }}
        >
          {t('a2hs_install')}
        </button>
      ) : ios ? (
        <div className="gs-a2hs__text">
          {t('a2hs_ios_hint')}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => setGettingStartedTaskDone('add_to_home')}>
              {t('a2hs_ios_done')}
            </button>
          </div>
        </div>
      ) : (
        <div className="gs-a2hs__text">
          {t('a2hs_other_hint')}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => setGettingStartedTaskDone('add_to_home')}>
              {t('a2hs_other_done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

