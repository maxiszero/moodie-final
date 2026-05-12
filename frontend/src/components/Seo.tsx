import { useEffect } from 'react'
import { useLocation, useMatch } from 'react-router-dom'
import { t } from '../i18n/i18n'
import { useSession } from '../state/SessionContext'
import { absoluteAssetUrl, getCurrentCanonicalHref, getPublicSiteOrigin } from '../config/site'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function Seo() {
  const { pathname } = useLocation()
  const profileMatch = useMatch('/profile/:username')
  const { lang } = useSession()

  useEffect(() => {
    const siteOrigin = getPublicSiteOrigin()
    const canonical = getCurrentCanonicalHref()
    const description = t('seo_meta_description')
    const title =
      pathname === '/lenta'
        ? t('seo_title_lenta')
        : pathname === '/search'
          ? t('seo_title_search')
          : pathname === '/register'
          ? t('seo_title_register')
          : pathname === '/settings'
            ? t('seo_title_settings')
            : pathname === '/admin'
              ? t('seo_title_admin')
              : pathname.startsWith('/tests')
                ? t('seo_title_tests')
                : profileMatch?.params.username
                  ? t('seo_title_profile').replace('{u}', profileMatch.params.username)
                  : t('seo_title_home')

    document.title = title

    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', 'index, follow, max-image-preview:large')
    upsertMeta('name', 'googlebot', 'index, follow, max-image-preview:large')

    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:locale', lang === 'en' ? 'en_US' : 'ru_RU')
    if (siteOrigin) {
      upsertMeta('property', 'og:url', canonical)
      upsertMeta('property', 'og:image', absoluteAssetUrl('logo.png'))
      upsertMeta('property', 'og:image:alt', 'Moodie')
    }

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    if (siteOrigin) {
      upsertMeta('name', 'twitter:image', absoluteAssetUrl('logo.png'))
    }

    upsertLink('canonical', canonical)

    return undefined
  }, [pathname, profileMatch?.params.username, lang])

  return null
}
