export function resolveMoodieApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const metaUrl = document.querySelector<HTMLMetaElement>('meta[name="moodie-api-url"]')
  const fromMeta = metaUrl?.getAttribute('content')?.trim()
  if (fromMeta) return fromMeta.replace(/\/$/, '')

  const { protocol, hostname } = window.location
  const portStr = window.location.port

  if (hostname === 'localhost' || hostname === '127.0.0.1' || (protocol === 'file:' && !hostname)) {
    return '/api'
  }

  const lan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname || '')
  if (lan && portStr && portStr !== '5000') {
    return `${protocol}//${hostname}:5000/api`
  }

  const metaBase = document.querySelector<HTMLMetaElement>('meta[name="moodie-app-base"]')
  const basePath = metaBase?.getAttribute('content')?.trim()
    ? metaBase.getAttribute('content')!.trim().replace(/\/$/, '')
    : ''

  if (basePath) {
    return `${window.location.origin}${basePath}/api`
  }

  return `${window.location.origin}/api`
}

export const API_URL = resolveMoodieApiUrl()
