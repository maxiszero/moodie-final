import { useEffect, useMemo, useState } from 'react'
import type { Post, PostComment, PostReaction } from '../types'
import { useSession } from '../state/SessionContext'
import { apiFetch } from '../api/apiClient'
import { getLang, t } from '../i18n/i18n'
import { PostText } from './PostText'
import { softMoodShadow } from '../ui/moodShadow'
import { ONBOARDING_EMOTION_CARDS } from '../config/emotionPalette'
import { setGettingStartedTaskDone } from '../ui/gettingStarted'
import { PostComments } from './PostComments'
import { showToast } from '../ui/toast'

function firstEmoji(s?: string) {
  if (!s) return '😐'
  const m = s.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)
  return m ? m[0] : '😐'
}

function authorFrom(post: Post) {
  return typeof post.userId === 'object' ? post.userId : null
}

function reactionCount(reactions: PostReaction[] | undefined, type: PostReaction['type']) {
  return (reactions || []).filter((r) => r.type === type).length
}

function isReactionActive(
  reactions: PostReaction[] | undefined,
  type: PostReaction['type'],
  userId: string | null,
) {
  if (!userId) return false
  return (reactions || []).some((r) => r.type === type && String(r.userId) === String(userId))
}

export function PostCard({
  post,
  onPostUpdated,
  onDeleted,
  onCommentsOpenChange,
  commentsOpen,
  isCommentsFocus,
  registerRef,
}: {
  post: Post
  onPostUpdated: (next: Post) => void
  onDeleted: (id: string) => void
  onCommentsOpenChange?: (open: boolean, postId: string) => void
  commentsOpen?: boolean
  isCommentsFocus?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}) {
  const s = useSession()
  const author = authorFrom(post)
  const authorName = author?.username || 'unknown'

  const postMood = useMemo(() => {
    const emoji = firstEmoji(post.emoji || author?.currentEmoji)
    const emotion = (post.emotion || author?.currentEmotion || 'neutral').toLowerCase()

    // Для постов держим цвета строго по эмоции, чтобы “злость” не подсвечивалась зелёным из user.currentColor и т.п.
    const palette = ONBOARDING_EMOTION_CARDS.find((c) => c.emotion === emotion)
    const c1 = palette?.glow || post.color || author?.currentColor || '#9E9E9E'
    const c2 = palette?.color2 || post.color2 || post.color || author?.currentColor2 || '#757575'
    const c3 = palette?.color3 || post.color3 || post.color2 || post.color || author?.currentColor3 || '#616161'
    return {
      emoji,
      emotion,
      intensity: post.intensity || 50,
      c1,
      c2,
      c3,
      gradient: `linear-gradient(135deg, ${c1}, ${c2}, ${c3}, ${c2}, ${c1})`,
    }
  }, [
    author?.currentColor,
    author?.currentColor2,
    author?.currentColor3,
    author?.currentEmoji,
    author?.currentEmotion,
    post.color,
    post.color2,
    post.color3,
    post.emoji,
    post.emotion,
    post.intensity,
  ])

  const [menuOpen, setMenuOpen] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportLock, setSupportLock] = useState(false)
  const [supportUntil, setSupportUntil] = useState(0)

  const SUPPORT_COOLDOWN_MS = 15_000

  const isOwn = Boolean(s.userId && (author?._id ? String(author._id) === String(s.userId) : false))

  let animClass = ''
  if (['happy', 'excited', 'loved', 'inspiration', 'drive', 'funny'].includes(postMood.emotion)) animClass = 'anim-happy'
  else if (['sad', 'melancholy', 'apathy'].includes(postMood.emotion)) animClass = 'anim-sad'
  else if (['anxious', 'scared', 'angry'].includes(postMood.emotion)) animClass = 'anim-anxious'
  else if (['calmness', 'neutral', 'tired'].includes(postMood.emotion)) animClass = 'anim-calm'

  const intensityFactor = postMood.intensity / 100
  const animSpeed = `${5 / (intensityFactor + 0.5)}s`

  const isRelatable =
    Boolean(post.relatableBy && s.userId && post.relatableBy.some((id) => String(id) === String(s.userId))) || false

  const sendSupport = async (text: string) => {
    if (!s.isAuthed) return
    if (supportLock) return
    const now = Date.now()
    if (supportUntil && now < supportUntil) {
      const left = Math.max(1, Math.ceil((supportUntil - now) / 1000))
      showToast(t('quick_support_cooldown').replace('{s}', String(left)), 'info')
      return
    }
    setSupportLock(true)
    try {
      await apiFetch<PostComment>(`/posts/${post._id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      onPostUpdated({ ...post, commentsCount: (post.commentsCount ?? 0) + 1 })
      setSupportOpen(false)
      setSupportUntil(Date.now() + SUPPORT_COOLDOWN_MS)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error'
      showToast(msg, 'error')
    } finally {
      setTimeout(() => setSupportLock(false), 500)
    }
  }

  useEffect(() => {
    if (!supportOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSupportOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [supportOpen])

  return (
    <div
      className={`post-card living-post ${animClass} ${isCommentsFocus ? 'post-card--comments-focus' : ''}`}
      id={`post-${post._id}`}
      ref={registerRef}
      style={
        {
          ['--post-gradient' as any]: postMood.gradient,
          ['--intensity-val' as any]: postMood.intensity,
          ['--anim-speed' as any]: animSpeed,
          boxShadow: softMoodShadow(postMood.c1),
        } as any
      }
      onClick={() => {
        if (menuOpen) setMenuOpen(false)
        if (supportOpen) setSupportOpen(false)
      }}
    >
      <div className="post-content-container">
        <div className="post-menu-container">
          <button
            type="button"
            className="post-menu-btn"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          <div className={`post-menu-dropdown ${menuOpen ? '' : 'hidden'}`} id={`post-menu-dropdown-${post._id}`}>
            {!isOwn ? (
              <>
                <button
                  type="button"
                  className="post-menu-item"
                  onClick={async () => {
                    setMenuOpen(false)
                    await apiFetch(`/posts/${post._id}/report`, { method: 'POST' })
                  }}
                >
                  <span>🚩</span>
                  <div>
                    <span>{t('report')}</span>
                    <small className="post-menu-item-desc">{t('report_desc')}</small>
                  </div>
                </button>
                <button
                  type="button"
                  className="post-menu-item"
                  onClick={async () => {
                    setMenuOpen(false)
                    await apiFetch(`/users/${encodeURIComponent(authorName)}/block`, { method: 'POST' })
                    window.location.hash = '#/'
                  }}
                >
                  <span>🚫</span>
                  <div>
                    <span>{t('block_user')}</span>
                    <small className="post-menu-item-desc">{t('block_user_desc').replace('{u}', authorName)}</small>
                  </div>
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="post-menu-item"
              onClick={() => {
                setMenuOpen(false)
                setShowReasoning((v) => !v)
              }}
            >
              <span>🧠</span>
              <div>
                <span>{t('ai_reasoning_title')}</span>
                <small className="post-menu-item-desc">{t('ai_reasoning_desc')}</small>
              </div>
            </button>
            {isOwn ? (
              <button
                type="button"
                className="post-menu-item danger"
                onClick={async () => {
                  setMenuOpen(false)
                  await apiFetch(`/posts/${post._id}`, { method: 'DELETE' })
                  onDeleted(post._id)
                }}
              >
                <span>🗑️</span>
                <div>
                  <span>{t('delete_post')}</span>
                  <small className="post-menu-item-desc">{t('delete_post_desc')}</small>
                </div>
              </button>
            ) : null}
          </div>
        </div>

        <div className="post-header">
          <div
            className="user-circle"
            style={{
              background: postMood.gradient,
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
            title={`${t('profile_status')}: ${postMood.emotion}`}
          >
            {postMood.emoji}
          </div>
          <div className="post-meta">
            <div className="post-author-row">
              <a className="post-author profile-link" href={`#/profile/${encodeURIComponent(authorName)}`}>
                {authorName}
              </a>
              <span className="emotion-label" style={{ background: 'var(--bg-color)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                {postMood.emotion}
              </span>
            </div>
            {s.isAuthed && s.username && authorName !== s.username && post.isFollowingAuthor === false ? (
              <div className="post-subscribe-row">
                <button
                  type="button"
                  className="post-subscribe-btn"
                  onClick={async () => {
                    const res = await apiFetch<{ isFollowing: boolean }>(`/users/${encodeURIComponent(authorName)}/follow`, { method: 'POST' })
                    onPostUpdated({ ...post, isFollowingAuthor: res.isFollowing })
                    setGettingStartedTaskDone('first_follow')
                  }}
                >
                  {t('follow')}
                </button>
              </div>
            ) : null}
            <span className="post-time">
              {new Date(post.createdAt).toLocaleString(getLang() === 'en' ? 'en-US' : 'ru-RU', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="post-content" style={{ marginTop: 16, fontSize: '1.1rem', fontWeight: 500 }}>
          <PostText text={post.text} />
        </div>

        <div id={`ai-reasoning-${post._id}`} className={`ai-reasoning-box ${showReasoning ? '' : 'hidden'}`} style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
          <strong>{t('ai_analysis')}:</strong> {post.reasoning || '—'}
        </div>

        <div className="reaction-group">
          <button
            type="button"
            className={`reaction-btn ${isReactionActive(post.reactions, 'feel_this', s.userId) ? 'active' : ''}`}
            data-reaction-type="feel_this"
            onClick={async () => {
              const data = await apiFetch<{ reactions: PostReaction[] }>(`/posts/${post._id}/reaction`, {
                method: 'POST',
                body: JSON.stringify({ reactionType: 'feel_this' }),
              })
              onPostUpdated({ ...post, reactions: data.reactions })
              setGettingStartedTaskDone('first_reaction')
            }}
          >
            <span>🫂</span>
            <span>{t('reaction_feel_this')}</span>
            <span className="reaction-count">{reactionCount(post.reactions, 'feel_this')}</span>
          </button>
          <button
            type="button"
            className={`reaction-btn ${isReactionActive(post.reactions, 'stay_strong', s.userId) ? 'active' : ''}`}
            data-reaction-type="stay_strong"
            onClick={async () => {
              const data = await apiFetch<{ reactions: PostReaction[] }>(`/posts/${post._id}/reaction`, {
                method: 'POST',
                body: JSON.stringify({ reactionType: 'stay_strong' }),
              })
              onPostUpdated({ ...post, reactions: data.reactions })
              setGettingStartedTaskDone('first_reaction')
            }}
          >
            <span>🛡️</span>
            <span>{t('reaction_stay_strong')}</span>
            <span className="reaction-count">{reactionCount(post.reactions, 'stay_strong')}</span>
          </button>
          <button
            type="button"
            className={`reaction-btn ${isReactionActive(post.reactions, 'hits_hard', s.userId) ? 'active' : ''}`}
            data-reaction-type="hits_hard"
            onClick={async () => {
              const data = await apiFetch<{ reactions: PostReaction[] }>(`/posts/${post._id}/reaction`, {
                method: 'POST',
                body: JSON.stringify({ reactionType: 'hits_hard' }),
              })
              onPostUpdated({ ...post, reactions: data.reactions })
              setGettingStartedTaskDone('first_reaction')
            }}
          >
            <span>🔥</span>
            <span>{t('reaction_hits_hard')}</span>
            <span className="reaction-count">{reactionCount(post.reactions, 'hits_hard')}</span>
          </button>
          <button
            type="button"
            className={`reaction-btn ${isRelatable ? 'active' : ''}`}
            onClick={async () => {
              const data = await apiFetch<{ relatable: number; relatableBy: string[] }>(`/posts/${post._id}/relatable`, { method: 'POST' })
              onPostUpdated({ ...post, relatable: data.relatable, relatableBy: data.relatableBy })
              setGettingStartedTaskDone('first_reaction')
            }}
          >
            <span>🤝</span>
            <span>{t('reaction_relatable')}</span>
            <span className="relatable-count">{post.relatable || 0}</span>
          </button>

          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="reaction-btn"
              disabled={!s.isAuthed}
              onClick={() => setSupportOpen((v) => !v)}
              aria-expanded={supportOpen}
            >
              <span>🫂</span>
              <span>{t('quick_support_title')}</span>
            </button>
            {supportOpen ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  zIndex: 50,
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 14,
                  padding: 8,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  minWidth: 240,
                  transformOrigin: 'top left',
                  animation: 'commentsPanelIn 160ms ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className="reaction-btn" disabled={supportLock} onClick={() => void sendSupport(t('quick_support_1'))}>
                  <span>🛡️</span>
                  <span>{t('quick_support_1')}</span>
                </button>
                <button type="button" className="reaction-btn" disabled={supportLock} onClick={() => void sendSupport(t('quick_support_2'))}>
                  <span>🫂</span>
                  <span>{t('quick_support_2')}</span>
                </button>
                <button type="button" className="reaction-btn" disabled={supportLock} onClick={() => void sendSupport(t('quick_support_3'))}>
                  <span>🤝</span>
                  <span>{t('quick_support_3')}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="post-comments__action-row">
          <button
            type="button"
            className={`post-comments__action-btn ${commentsOpen ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onCommentsOpenChange?.(!commentsOpen, post._id)
            }}
            aria-expanded={Boolean(commentsOpen)}
          >
            <span aria-hidden>💬</span>
            <span className="post-comments__action-label">{t('comments_button')}</span>
            {(post.commentsCount ?? 0) > 0 ? <span className="post-comments__action-count">{post.commentsCount ?? 0}</span> : null}
          </button>
        </div>

        <PostComments
          post={post}
          onPostUpdated={onPostUpdated}
          open={Boolean(commentsOpen)}
          onOpenChange={(open) => onCommentsOpenChange?.(open, post._id)}
        />
      </div>
    </div>
  )
}

