import { useSession } from '../state/SessionContext'
import { storageKeys } from '../config/storage'
import { t } from '../i18n/i18n'
import { isTelegramMiniApp } from '../telegram/webApp'

type Props = {
  open: boolean
  onClose: () => void
}

export function TelegramOnboardingModal({ open, onClose }: Props) {
  const s = useSession()

  if (!open || !isTelegramMiniApp()) return null

  const done = () => {
    try {
      localStorage.setItem(storageKeys.hasSeenTelegramOnboarding, '1')
    } catch {
      /* ignore */
    }
    onClose()
  }

  return (
    <div className="tg-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="tgOnboardingTitle">
      <div className="tg-onboarding-card">
        <h2 id="tgOnboardingTitle">{t('tg_onboarding_title')}</h2>
        <p className="tg-onboarding-lead">{t('tg_onboarding_lead')}</p>
        <ol className="tg-onboarding-steps">
          <li className={s.telegramLinked ? 'tg-onboarding-steps__done' : ''}>
            <strong>{t('tg_onboarding_step1_title')}</strong>
            <span>{t('tg_onboarding_step1_desc')}</span>
          </li>
          <li>
            <strong>{t('tg_onboarding_step2_title')}</strong>
            <span>{t('tg_onboarding_step2_desc')}</span>
          </li>
          <li>
            <strong>{t('tg_onboarding_step3_title')}</strong>
            <span>{t('tg_onboarding_step3_desc')}</span>
          </li>
        </ol>
        <div className="tg-onboarding-actions">
          {!s.telegramLinked ? (
            <a className="tg-onboarding-btn tg-onboarding-btn--primary" href="#/settings">
              {t('tg_onboarding_open_settings')}
            </a>
          ) : null}
          <button type="button" className="tg-onboarding-btn" onClick={done}>
            {t('tg_onboarding_got_it')}
          </button>
        </div>
      </div>
    </div>
  )
}
