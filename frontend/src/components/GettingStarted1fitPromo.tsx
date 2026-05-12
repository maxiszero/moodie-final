import { t } from '../i18n/i18n'
import { useFitPromoCountdown } from '../ui/promo1fit'

export function GettingStarted1fitPromo() {
  const { expired, countdown } = useFitPromoCountdown()

  return (
    <div className="gs-1fit-promo" role="region" aria-label="1FIT">
      <div className="gs-1fit-promo__badge">{t('gs_1fit_promo_badge')}</div>
      <p className="gs-1fit-promo__intro">{t('gs_1fit_promo_intro')}</p>
      {expired ? (
        <p className="gs-1fit-promo__expired">{t('gs_1fit_expired')}</p>
      ) : (
        <div className="gs-1fit-promo__countdown" aria-live="polite">
          <span className="gs-1fit-promo__label">{t('gs_1fit_until_label')}</span>
          <strong className="gs-1fit-promo__time">{countdown}</strong>
        </div>
      )}
    </div>
  )
}
