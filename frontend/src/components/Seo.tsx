import { useEffect, useState } from 'react'
import { useLocation, useMatch, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api/apiClient'
import { t } from '../i18n/i18n'
import { useSession } from '../state/SessionContext'
import type { Post } from '../types'
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
  const [searchParams] = useSearchParams()
  const profileMatch = useMatch('/profile/:username')
  const { lang } = useSession()
  const [dynamic, setDynamic] = useState<{ title: string; description: string } | null>(null)

  const postId = searchParams.get('post')
  const username = profileMatch?.params.username

  useEffect(() => {
    if (!username) {
      setDynamic(null)
      return
    }
    let alive = true
    const load = async () => {
      if (postId) {
        try {
          const post = await apiFetch<Post>(`/posts/${encodeURIComponent(postId)}`, { auth: false })
          const author =
            post.userId && typeof post.userId === 'object' && 'username' in post.userId
              ? String((post.userId as { username: string }).username)
              : username
          const snippet = (post.text || '').replace(/\s+/g, ' ').trim().slice(0, 160)
          const emoji = post.emoji || '😐'
          if (alive) {
            setDynamic({
              title: t('seo_title_post').replace('{u}', author).replace('{e}', emoji),
              description: snippet || t('seo_meta_description'),
            })
          }
          return
        } catch {
          /* fall through to profile */
        }
      }
      try {
        const payload = await apiFetch<{ user: { username: string; currentEmoji?: string; currentEmotion?: string } }>(
          `/users/${encodeURIComponent(username)}`,
          { auth: false },
        )
        const u = payload.user
        const emoji = u.currentEmoji || '😐'
        const emotion = u.currentEmotion || 'neutral'
        if (alive) {
          setDynamic({
            title: t('seo_title_profile').replace('{u}', u.username),
            description: t('seo_desc_profile').replace('{e}', emoji).replace('{m}', emotion),
          })
        }
      } catch {
        if (alive) setDynamic(null)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [username, postId])

  useEffect(() => {
    const siteOrigin = getPublicSiteOrigin()
    const canonical = getCurrentCanonicalHref()
    const description = dynamic?.description || t('seo_meta_description')
    const title =
      dynamic?.title ||
      (pathname === '/lenta'
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
                    : t('seo_title_home'))

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
  }, [pathname, profileMatch?.params.username, lang, dynamic])

  return null
}
