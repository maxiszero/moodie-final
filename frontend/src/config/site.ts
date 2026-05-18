/**
 * Origin (scheme + host) for absolute asset URLs and OG tags.
 * Set `VITE_SITE_URL` to either your origin (`https://example.com`) or full app URL — only the origin is used with Vite `base`.
 */
export function getPublicSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim()
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin
    } catch {
      return fromEnv.replace(/\/$/, '')
    }
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Absolute URL to a static asset under Vite base (e.g. logo.png). */
export function absoluteAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const origin = getPublicSiteOrigin()
  if (!origin) return path
  try {
    return new URL(path.replace(/^\//, ''), `${origin}${base.replace(/\/?$/, '/')}`).href
  } catch {
    return path
  }
}

/** Canonical URL for the current page (hash included for HashRouter). */
export function getCurrentCanonicalHref(): string {
  if (typeof window === 'undefined') return ''
  return window.location.href.split('?')[0]
}

/** Crawler-friendly share URL for a post (OG HTML on /share/post/:id). */
export function sharePostUrl(postId: string): string {
  const origin = getPublicSiteOrigin()
  if (!origin) return `${window.location.origin}${window.location.pathname}#/profile/?post=${encodeURIComponent(postId)}`
  return `${origin}/share/post/${encodeURIComponent(postId)}`
}

/** Crawler-friendly share URL for a profile. */
export function shareProfileUrl(username: string): string {
  const origin = getPublicSiteOrigin()
  const hash = `#/profile/${encodeURIComponent(username)}`
  if (!origin) return `${window.location.origin}${window.location.pathname}${hash}`
  return `${origin}/share/profile/${encodeURIComponent(username)}`
}

/** In-app deep link (hash route). */
export function profilePostDeepLink(username: string, postId: string): string {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
  return `${base}#/profile/${encodeURIComponent(username)}?post=${encodeURIComponent(postId)}`
}
