import { GettingStartedWidget } from '../components/GettingStartedWidget'
import { t } from '../i18n/i18n'

export function GettingStartedPage() {
  return (
    <div id="gettingStartedView" className="main-content getting-started-page">
      <h1 className="page-title">{t('gs_title')}</h1>
      <p className="getting-started-page__lead">{t('gs_modal_intro')}</p>
      <GettingStartedWidget />
    </div>
  )
}
