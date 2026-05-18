import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../api/apiClient'
import { ONBOARDING_EMOTION_CARDS } from '../config/emotionPalette'
import { t } from '../i18n/i18n'
import { useSession } from '../state/SessionContext'
import type { MoodGradientMode, Post, PublicUser, Theme } from '../types'
import { moodLinearGradient135 } from '../ui/moodGradientStyle'

function userGradient(u: PublicUser, moodGradientMode: MoodGradientMode, theme: Theme) {
  const c1 = u.currentColor || '#E0E7FF'
  const c2 = u.currentColor2 || c1
  const c3 = u.currentColor3 || c2
  return moodLinearGradient135(c1, c2, c3, moodGradientMode, theme)
}

const searchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
)

function clipText(s: string, max: number) {
  const one = s.replace(/\s+/g, ' ').trim()
  if (one.length <= max) return one
  return `${one.slice(0, max)}…`
}

function postAuthorName(p: Post) {
  const a = p.userId
  if (a && typeof a === 'object' && 'username' in a) return String((a as { username: string }).username)
  return '…'
}

export type HeaderSearchRef = {
  focusAndApplyQuery: (q: string) => void
}

type HeaderSearchProps = {
  onSearchExecuted?: (trimmed: string) => void
}

export const HeaderSearch = forwardRef<HeaderSearchRef, HeaderSearchProps>(function HeaderSearch(
  { onSearchExecuted },
  ref,
) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userResults, setUserResults] = useState<PublicUser[]>([])
  const [postResults, setPostResults] = useState<Post[]>([])
  const [err, setErr] = useState('')
  const sess = useSession()

  const runSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim()
      if (trimmed.length < 2) {
        setUserResults([])
        setPostResults([])
        setErr('')
        return
      }
      setLoading(true)
      setErr('')
      const qEnc = encodeURIComponent(trimmed)
      try {
        const [uRes, pRes] = await Promise.allSettled([
          apiFetch<PublicUser[]>(`/users/search?q=${qEnc}`),
          apiFetch<Post[]>(`/posts/search?q=${qEnc}`),
        ])
        if (uRes.status === 'fulfilled' && Array.isArray(uRes.value)) setUserResults(uRes.value)
        else setUserResults([])
        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) setPostResults(pRes.value)
        else setPostResults([])
        if (uRes.status === 'rejected' && pRes.status === 'rejected') {
          const e = uRes.status === 'rejected' ? uRes.reason : pRes.reason
          setErr(
            e && typeof e === 'object' && e && 'message' in e
              ? String((e as { message: string }).message)
              : t('search_error'),
          )
        } else {
          setErr('')
          onSearchExecuted?.(trimmed)
        }
      } catch (e: unknown) {
        setUserResults([])
        setPostResults([])
        setErr(
          e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : t('search_error'),
        )
      } finally {
        setLoading(false)
      }
    },
    [onSearchExecuted],
  )

  useImperativeHandle(
    ref,
    () => ({
      focusAndApplyQuery: (s: string) => {
        const t = s.trim()
        setQ(s)
        setOpen(true)
        inputRef.current?.focus()
        if (t.length >= 2) {
          void runSearch(s)
        }
      },
    }),
    [runSearch],
  )

  useEffect(() => {
    if (!open || q.trim().length < 2) return
    const h = window.setTimeout(() => {
      void runSearch(q)
    }, 320)
    return () => window.clearTimeout(h)
  }, [q, open, runSearch])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const showPanel = open && (q.trim().length >= 2 || loading)

  return (
    <div className="header-search" ref={rootRef}>
      <label htmlFor={id} className="header-search__label">
        {searchIcon}
        <span className="hidden">{t('nav_search')}</span>
      </label>
      <input
        id={id}
        ref={inputRef}
        type="search"
        className="header-search__input"
        placeholder={t('search_placeholder')}
        value={q}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showPanel}
        onChange={(e) => {
          setQ(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim().length > 0 && q.trim().length < 2 ? (
        <div className="header-search__panel header-search__panel--hint" role="status">
          {t('search_empty')}
        </div>
      ) : null}
      {showPanel && q.trim().length >= 2 ? (
        <div className="header-search__panel" role="listbox">
          {loading ? (
            <div className="header-search__status">…</div>
          ) : err ? (
            <div className="header-search__status header-search__status--err">{err}</div>
          ) : userResults.length === 0 && postResults.length === 0 ? (
            <div className="header-search__status">{t('search_no_results')}</div>
          ) : (
            <>
              {userResults.length > 0 ? (
                <>
                  <div className="header-search__section-title">{t('search_section_users')}</div>
                  <ul className="header-search__list">
                    {userResults.map((u) => {
                      const href = `#/profile/${encodeURIComponent(u.username)}`
                      const pal = ONBOARDING_EMOTION_CARDS.find(
                        (c) => c.emotion === String(u.currentEmotion || '').toLowerCase(),
                      )
                      const glow = pal?.glow
                      return (
                        <li key={u._id} role="option">
                          <a
                            className="header-search__row"
                            href={href}
                            onClick={() => {
                              setOpen(false)
                              setQ('')
                            }}
                          >
                            <div
                              className="user-circle user-circle--sm"
                              style={{
                                background: userGradient(u, sess.moodGradientMode, sess.theme),
                                boxShadow: glow ? `0 0 0 1px ${glow}33` : undefined,
                              }}
                            >
                              {u.currentEmoji || '😐'}
                            </div>
                            <span className="header-search__name">@{u.username}</span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : null}
              {postResults.length > 0 ? (
                <>
                  <div className="header-search__section-title">{t('search_section_posts')}</div>
                  <ul className="header-search__list">
                    {postResults.map((p) => {
                      const name = postAuthorName(p)
                      const href = `#/profile/${encodeURIComponent(name)}?post=${encodeURIComponent(p._id)}`
                      return (
                        <li key={p._id} role="option">
                          <a
                            className="header-search__row header-search__row--post"
                            href={href}
                            onClick={() => {
                              setOpen(false)
                              setQ('')
                            }}
                          >
                            <div className="header-search__post-text">
                              <span className="header-search__post-snippet">{clipText(p.text, 120)}</span>
                              <span className="header-search__post-meta">@{name}</span>
                            </div>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
})

HeaderSearch.displayName = 'HeaderSearch'
