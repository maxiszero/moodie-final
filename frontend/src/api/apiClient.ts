import { API_URL } from '../config/apiUrl'
import { getToken } from '../config/storage'

export type ApiError = {
  status: number
  message: string
  details?: unknown
}

async function readJsonSafely(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`

  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')

  const wantsAuth = init.auth !== false
  if (wantsAuth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(url, { ...init, headers })
  const data = await readJsonSafely(res)

  if (!res.ok) {
    const msg: string =
      (data && typeof data === 'object' && data !== null && 'message' in (data as any)
        ? String((data as any).message)
        : `${res.status} ${res.statusText}`)
    const err: ApiError = { status: res.status, message: msg, details: data }
    throw err
  }

  return data as T
}
