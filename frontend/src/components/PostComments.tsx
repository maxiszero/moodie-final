import { useCallback, useEffect, useState } from 'react'
import type { MoodGradientMode, Post, PostComment, Theme } from '../types'
import { useSession } from '../state/SessionContext'
import { apiFetch } from '../api/apiClient'
import { getLang, t } from '../i18n/i18n'
import { PostText } from './PostText'
import { moodLinearGradient135 } from '../ui/moodGradientStyle'

function authorName(c: PostComment) {
  const u = c.userId
  if (u && typeof u === 'object' && 'username' in u) return String((u as { username: string }).username)
  return '…'
}

function userGradient(c: PostComment, moodGradientMode: MoodGradientMode, theme: Theme) {
  const u = c.userId
  if (!u || typeof u !== 'object')
    return moodLinearGradient135('#E0E7FF', '#A5B4FC', '#6366F1', moodGradientMode, theme)
  const c1 = (u as { currentColor?: string }).currentColor || '#E0E7FF'
  const c2 = (u as { currentColor2?: string }).currentColor2 || c1
  const c3 = (u as { currentColor3?: string }).currentColor3 || c2
  return moodLinearGradient135(c1, c2, c3, moodGradientMode, theme)
}

// (mobile sheet preview helpers removed; comments are always inline now)

type PanelProps = {
  n: number
  items: PostComment[]
  loading: boolean
  err: string
  text: string
  setText: (v: string) => void
  busy: boolean
  s: ReturnType<typeof useSession>
  onSend: () => void
  onRemove: (id: string) => void
  onRequestClose: () => void
}

function CommentsThread({
  n,
  items,
  loading,
  err,
  text,
  setText,
  busy,
  s,
  onSend,
  onRemove,
  onRequestClose,
}: PanelProps) {
  return (
    <>
      {n > 0 && (
        <div className="post-comments__bar">
          <button type="button" className="post-comments__hide" onClick={onRequestClose} aria-expanded>
            {t('comments_hide')}
          </button>
        </div>
      )}

      {n > 0 && loading && items.length === 0 ? <div className="post-comments__status">{t('comment_loading')}</div> : null}
      {err ? <div className="post-comments__err">{err}</div> : null}
      {n > 0 && !loading && items.length === 0 && !err ? <p className="post-comments__empty">{t('comments_empty_list')}</p> : null}
      {n === 0 ? <p className="post-comments__hint">{t('comments_be_first')}</p> : null}

      {items.length > 0 && (
        <ul className="post-comments__list">
          {items.map((c) => {
            const name = authorName(c)
            const uid = c.userId && typeof c.userId === 'object' && '_id' in c.userId ? String((c.userId as { _id: string })._id) : ''
            const own = s.userId && uid && String(s.userId) === String(uid)
            return (
              <li key={c._id} className="post-comments__row">
                <a className="post-comments__avatar" href={`#/profile/${encodeURIComponent(name)}`} title={name}>
                  <div className="user-circle user-circle--sm" style={{ background: userGradient(c, s.moodGradientMode, s.theme) }}>
                    {(c.userId && typeof c.userId === 'object' && (c.userId as { currentEmoji?: string }).currentEmoji) || '😐'}
                  </div>
                </a>
                <div className="post-comments__body">
                  <div className="post-comments__meta">
                    <a className="post-comments__author" href={`#/profile/${encodeURIComponent(name)}`}>
                      {name}
                    </a>
                    <span className="post-comments__time">
                      {new Date(c.createdAt).toLocaleString(getLang() === 'en' ? 'en-US' : 'ru-RU', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="post-comments__text">
                    <PostText text={c.text} />
                  </div>
                </div>
                {own || s.role === 'admin' ? (
                  <button type="button" className="post-comments__remove" onClick={() => void onRemove(c._id)} title={t('comment_delete')}>
                    ×
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {s.isAuthed ? (
        <div className="post-comments__composer">
          <textarea
            className="post-comments__input"
            rows={2}
            maxLength={500}
            placeholder={t('comment_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void onSend()
              }
            }}
          />
          <div className="post-comments__send-row">
            <span className="post-comments__hint-kbd">{t('comment_shortcut_hint')}</span>
            <button type="button" className="btn-primary post-comments__send" onClick={() => void onSend()} disabled={busy || !text.trim()}>
              {busy ? t('publishing') : t('comment_send')}
            </button>
          </div>
        </div>
      ) : (
        <p className="post-comments__login-hint">{t('comments_login_hint')}</p>
      )}
    </>
  )
}

export function PostComments({
  post,
  onPostUpdated,
  open,
  onOpenChange,
}: {
  post: Post
  onPostUpdated: (next: Post) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const s = useSession()
  const n = post.commentsCount ?? 0
  const [items, setItems] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const data = await apiFetch<PostComment[]>(`/posts/${post._id}/comments`)
      setItems(Array.isArray(data) ? data : [])
      setLoaded(true)
    } catch (e: unknown) {
      setItems([])
      setErr(
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : t('comment_load_error'),
      )
    } finally {
      setLoading(false)
    }
  }, [post._id])

  useEffect(() => {
    const needLoad = n > 0 && !loaded
    if (!needLoad) return
    if (open) void load()
  }, [n, loaded, open, load])

  const send = async (overrideText?: string) => {
    const w = (overrideText ?? text).trim()
    if (!w || busy || w.length > 500) return
    setBusy(true)
    setErr('')
    try {
      const c = await apiFetch<PostComment>(`/posts/${post._id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: w }),
      })
      setText('')
      setItems((prev) => [...prev, c])
      setLoaded(true)
      onOpenChange(true)
      onPostUpdated({ ...post, commentsCount: (post.commentsCount ?? 0) + 1 })
    } catch (e: unknown) {
      setErr(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : t('comment_error'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await apiFetch(`/posts/${post._id}/comments/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x._id !== id))
      onPostUpdated({ ...post, commentsCount: Math.max(0, (post.commentsCount ?? 0) - 1) })
    } catch {
      /* ignore */
    }
  }

  const panelArgs: PanelProps = {
    n,
    items,
    loading,
    err,
    text,
    setText,
    busy,
    s,
    onSend: () => void send(),
    onRemove: remove,
    onRequestClose: () => onOpenChange(false),
  }

  return (
    <div className="post-comments" onClick={(e) => e.stopPropagation()}>
      {open ? (
        <div className="post-comments__panel post-comments__panel--open">
          <CommentsThread {...panelArgs} />
        </div>
      ) : null}
    </div>
  )
}
