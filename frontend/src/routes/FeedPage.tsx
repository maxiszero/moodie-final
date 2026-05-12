import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/apiClient'
import { API_URL } from '../config/apiUrl'
import { useSession } from '../state/SessionContext'
import type { DailyQuestionToday, Post } from '../types'
import { useRealtime } from '../realtime/RealtimeContext'
import { PostCard } from '../components/PostCard'
import { DailyQuestionFeed } from '../components/DailyQuestionFeed'
import { MoodStatsPanel } from '../components/MoodStatsPanel'
import { useFeedMood } from '../state/FeedMoodContext'
import { t, getLang } from '../i18n/i18n'
import { applyTheme } from '../ui/theme'
import { setGettingStartedTaskDone } from '../ui/gettingStarted'

function textHasLink(s: string) {
  return /(https?:\/\/\S+|www\.\S+)/i.test(s)
}

type FeedPageProps = { guestLenta?: boolean }

export function FeedPage({ guestLenta }: FeedPageProps) {
  const s = useSession()
  const rt = useRealtime()
  const { emotionFilter, setEmotionFilter, stats, refetchStats } = useFeedMood()

  const [posts, setPosts] = useState<Post[]>([])
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null)
  const [sort, setSort] = useState<'latest' | 'trending' | 'daily'>('latest')
  const [loading, setLoading] = useState(false)
  const [initialError, setInitialError] = useState<string | null>(null)
  const [dqToday, setDqToday] = useState<DailyQuestionToday | null>(null)
  const [moodMix, setMoodMix] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('moodie_feedMoodMix')
      return v === '1'
    } catch {
      return false
    }
  })

  const [text, setText] = useState('')
  const [aiTipOpen, setAiTipOpen] = useState(false)
  const [aiTipText, setAiTipText] = useState('')
  const [postBusy, setPostBusy] = useState(false)
  const [aiTipBusy, setAiTipBusy] = useState(false)

  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const prependOkRef = useRef(true)
  const aiTipCacheRef = useRef<Map<string, { tip: string; at: number }>>(new Map())
  const aiTipTimerRef = useRef<number | null>(null)
  const aiTipAbortRef = useRef<AbortController | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (guestLenta && !s.isAuthed) {
      applyTheme('dark')
    }
  }, [guestLenta, s.isAuthed])

  useEffect(() => {
    if (!guestLenta && s.isAuthed) void s.refreshMe()
  }, [guestLenta, s.isAuthed, s.refreshMe])

  const loadDqToday = useCallback(async () => {
    try {
      const lang = getLang()
      const d = await apiFetch<DailyQuestionToday>(`/daily-question/today?lang=${lang}`, {
        auth: s.isAuthed,
      })
      setDqToday(d)
    } catch {
      setDqToday(null)
    }
  }, [s.isAuthed])

  useEffect(() => {
    void loadDqToday()
  }, [loadDqToday, s.lang, rt.dailyRolloverKey])

  const loadPosts = useCallback(
    async (isFirst: boolean) => {
      if (loadingRef.current) return
      if (!isFirst && !hasMoreRef.current) return
      loadingRef.current = true
      setLoading(true)
      if (isFirst) setInitialError(null)

      const p = pageRef.current
      try {
        let url = `/posts?sort=${encodeURIComponent(sort)}&page=${p}&limit=10`
        if (emotionFilter) url += `&emotion=${encodeURIComponent(emotionFilter)}`
        if (moodMix && s.isAuthed && !emotionFilter) url += `&moodMix=1`
        const data = await apiFetch<Post[]>(url, { auth: s.isAuthed })
        if (!Array.isArray(data)) throw new Error('Invalid response')

        hasMoreRef.current = data.length >= 10

        if (isFirst) {
          setPosts(data)
          prependOkRef.current = true
        } else {
          setPosts((prev) => [...prev, ...data])
          prependOkRef.current = false
        }
        pageRef.current = p + 1
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error'
        if (isFirst) {
          const hint = t('feed_error_hint').replace('{url}', API_URL)
          setInitialError(`${t('feed_error')}: ${msg}\n${hint}`)
        }
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [emotionFilter, moodMix, s.isAuthed, sort],
  )

  useEffect(() => {
    if (sort === 'daily') return
    pageRef.current = 1
    hasMoreRef.current = true
    setPosts([])
    prependOkRef.current = true
    void loadPosts(true)
  }, [sort, emotionFilter, loadPosts])

  useEffect(() => {
    try {
      localStorage.setItem('moodie_feedMoodMix', moodMix ? '1' : '0')
    } catch {
      // ignore
    }
    if (sort === 'daily') return
    pageRef.current = 1
    hasMoreRef.current = true
    setPosts([])
    prependOkRef.current = true
    void loadPosts(true)
  }, [moodMix])

  useEffect(() => {
    const onScroll = () => {
      if (sort === 'daily') return
      if (loadingRef.current || !hasMoreRef.current) return
      const root = document.scrollingElement ?? document.documentElement
      const { scrollTop, scrollHeight, clientHeight } = root
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        void loadPosts(false)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [loadPosts, sort])

  useEffect(() => {
    if (!rt.lastNewPost) return
    if (sort === 'daily') return
    if (sort !== 'latest' || emotionFilter) return
    if (!prependOkRef.current) return
    const p = rt.lastNewPost
    setPosts((prev) => {
      if (prev.some((x) => x._id === p._id)) return prev
      return [p, ...prev]
    })
  }, [emotionFilter, rt.lastNewPost, sort])

  const len = text.length
  const overLimit = len > 228
  const canSubmit = Boolean(s.isAuthed && text.trim() && !overLimit && !textHasLink(text))
  const myGradient = `linear-gradient(135deg, ${s.mood.color}, ${s.mood.color2}, ${s.mood.color3}, ${s.mood.color2}, ${s.mood.color})`

  useEffect(() => {
    // Debounced AI tip prefetch with short-lived cache
    if (!s.isAuthed) return
    const draft = text.trim()
    if (!draft || overLimit || textHasLink(draft)) return

    const key = draft.slice(0, 228)
    const cached = aiTipCacheRef.current.get(key)
    const now = Date.now()
    if (cached && now - cached.at < 5 * 60 * 1000) {
      return
    }

    if (aiTipTimerRef.current) window.clearTimeout(aiTipTimerRef.current)
    aiTipTimerRef.current = window.setTimeout(async () => {
      try {
        aiTipAbortRef.current?.abort()
        const ac = new AbortController()
        aiTipAbortRef.current = ac
        setAiTipBusy(true)
        const res = await apiFetch<{ tip: string }>('/posts/ai/tip', {
          method: 'POST',
          body: JSON.stringify({ text: key }),
          signal: ac.signal,
        })
        aiTipCacheRef.current.set(key, { tip: res.tip || '', at: Date.now() })
      } catch {
        // ignore (abort / rate-limit / transient)
      } finally {
        setAiTipBusy(false)
      }
    }, 550)

    return () => {
      if (aiTipTimerRef.current) {
        window.clearTimeout(aiTipTimerRef.current)
        aiTipTimerRef.current = null
      }
    }
  }, [overLimit, s.isAuthed, text])

  const showCreatePost = !guestLenta && s.isAuthed

  useEffect(() => {
    if (!showCreatePost) return
    const t = window.setTimeout(() => {
      composerRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    }, 0)
    return () => window.clearTimeout(t)
  }, [showCreatePost])

  const onlineText =
    rt.onlineCount === null ? t('online_unknown') : t('online_count').replace('{n}', String(rt.onlineCount))

  const showFeedLoader = sort === 'daily' ? !dqToday : loading && posts.length === 0

  return (
    <>
      {guestLenta && !s.isAuthed ? (
        <div
          id="lentaGuestOverlay"
          role="presentation"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            cursor: 'pointer',
          }}
          onClick={() => {
            window.location.hash = '#/'
            window.location.reload()
          }}
        />
      ) : null}

      {rt.onlineCount !== null ? (
        <div className="feed-online-badge" role="status" aria-live="polite">
          <span className="feed-online-badge__dot" aria-hidden />
          <span className="feed-online-badge__text">{onlineText}</span>
        </div>
      ) : null}

      {showCreatePost && dqToday && !dqToday.hasAnswered && sort !== 'daily' ? (
        <div className="daily-banner" role="status">
          <div className="daily-banner__text">
            <p className="daily-banner__title">{t('daily_banner_title')}</p>
            <p className="daily-banner__sub">{t('daily_banner_sub')}</p>
          </div>
          <button type="button" className="auth-btn daily-banner__btn" onClick={() => setSort('daily')}>
            {t('daily_banner_cta')}
          </button>
        </div>
      ) : null}

      {showCreatePost ? (
        <div ref={composerRef} className="create-post" id="feedComposer">
          <div className="create-post-header">
            <div
              className="user-circle"
              id="currentUserCircle"
              title=""
              style={{ cursor: 'default', background: myGradient }}
            >
              {s.mood.emoji || '😐'}
            </div>
            <div className="post-input-area">
              <textarea
                id="postInput"
                placeholder={t('post_placeholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <div className="create-post-actions">
            <button
              id="aiTipBtn"
              type="button"
              className="btn-secondary"
              style={{ marginRight: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}
              disabled={postBusy || aiTipBusy || !text.trim()}
              onClick={async () => {
                if (!text.trim()) {
                  alert(t('ai_tip_alert'))
                  return
                }
                const key = text.trim().slice(0, 228)
                const cached = aiTipCacheRef.current.get(key)
                const now = Date.now()
                if (cached && now - cached.at < 5 * 60 * 1000) {
                  setAiTipText(cached.tip || '')
                  setAiTipOpen(true)
                  return
                }

                setAiTipBusy(true)
                try {
                  const res = await apiFetch<{ tip: string }>('/posts/ai/tip', {
                    method: 'POST',
                    body: JSON.stringify({ text: key }),
                  })
                  aiTipCacheRef.current.set(key, { tip: res.tip || '', at: Date.now() })
                  setAiTipText(res.tip || '')
                  setAiTipOpen(true)
                } catch {
                  /* api throws */
                } finally {
                  setAiTipBusy(false)
                }
              }}
            >
              {t('ai_tip_btn')}
            </button>
            <span id="charCounter" className={`char-counter ${overLimit ? 'limit-reached' : ''}`}>
              {len}/228
            </span>
            <button
              id="postBtn"
              type="button"
              className="auth-btn"
              disabled={!canSubmit || postBusy}
              onClick={async () => {
                const content = text.trim()
                if (!content) return
                if (textHasLink(content)) {
                  alert(t('no_links'))
                  return
                }
                setPostBusy(true)
                try {
                  const newPost = await apiFetch<Post>('/posts', {
                    method: 'POST',
                    body: JSON.stringify({ text: content }),
                  })
                  setText('')
                  setAiTipOpen(false)
                  setAiTipText('')
                  setPosts((prev) => [newPost, ...prev.filter((x) => x._id !== newPost._id)])
                  const mood = {
                    emotion: newPost.emotion,
                    emoji: newPost.emoji,
                    color: newPost.color,
                    color2: newPost.color2 || newPost.color,
                    color3: newPost.color3 || newPost.color2 || newPost.color,
                  }
                  if (mood.emotion) localStorage.setItem('moodie_currentEmotion', String(mood.emotion))
                  if (mood.emoji) localStorage.setItem('moodie_currentEmoji', String(mood.emoji))
                  if (mood.color) localStorage.setItem('moodie_currentColor', String(mood.color))
                  if (mood.color2) localStorage.setItem('moodie_currentColor2', String(mood.color2))
                  if (mood.color3) localStorage.setItem('moodie_currentColor3', String(mood.color3))
                  setGettingStartedTaskDone('first_post')
                  await s.refreshMe()
                  await refetchStats()
                } catch (e: unknown) {
                  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'fail'
                  alert(msg)
                } finally {
                  setPostBusy(false)
                }
              }}
            >
              {postBusy ? t('publishing') : t('post')}
            </button>
          </div>
          <div id="aiTipContainer" className={`ai-tip-box ${aiTipOpen ? '' : 'hidden'}`}>
            <div className="ai-tip-content">{aiTipText}</div>
            <button type="button" className="ai-tip-close" onClick={() => setAiTipOpen(false)} aria-label="Close">
              &times;
            </button>
          </div>
        </div>
      ) : null}

      <div className="feed-mood-stats-slot">
        <MoodStatsPanel />
      </div>

      <div className="feed-tabs feed-tabs--three" role="tablist" aria-label={t('feed_tabs_label')}>
        <button
          type="button"
          className={`feed-tab ${sort === 'latest' ? 'active' : ''}`}
          data-sort="latest"
          role="tab"
          aria-selected={sort === 'latest'}
          id="tabLatest"
          onClick={() => setSort('latest')}
        >
          {t('tab_feed')}
        </button>
        <button
          type="button"
          className={`feed-tab ${sort === 'trending' ? 'active' : ''}`}
          data-sort="trending"
          role="tab"
          aria-selected={sort === 'trending'}
          id="tabTop"
          onClick={() => setSort('trending')}
        >
          {t('tab_top')}
        </button>
        <button
          type="button"
          className={`feed-tab ${sort === 'daily' ? 'active' : ''}`}
          data-sort="daily"
          role="tab"
          aria-selected={sort === 'daily'}
          id="tabDaily"
          onClick={() => setSort('daily')}
        >
          {t('tab_daily')}
        </button>
      </div>

      {!guestLenta && sort !== 'daily' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
          <button
            type="button"
            className={`btn-secondary ${moodMix ? 'active' : ''}`}
            disabled={!s.isAuthed}
            onClick={() => setMoodMix((v) => !v)}
            aria-pressed={moodMix}
          >
            {t('feed_mood_mix_label')}
          </button>
          {moodMix ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {t('feed_mood_mix_hint')}
            </span>
          ) : null}
        </div>
      ) : null}

      <div id="loader" className={`loader ${showFeedLoader ? '' : 'hidden'}`}>
        {t('loading_posts')}
      </div>

      <div id="moodFilters" className={`mood-filters ${sort === 'daily' ? 'hidden' : ''}`}>
        {stats.length > 0 ? (
          <>
            <button
              type="button"
              className={`mood-chip ${emotionFilter == null ? 'active' : ''}`}
              data-mood-filter="all"
              aria-pressed={emotionFilter == null}
              onClick={() => setEmotionFilter(null)}
            >
              {t('all_moods')}
            </button>
            {stats.map((st) => (
              <button
                key={st._id}
                type="button"
                className={`mood-chip ${emotionFilter === st._id ? 'active' : ''}`}
                data-mood-filter={st._id}
                aria-pressed={emotionFilter === st._id}
                onClick={() => setEmotionFilter(st._id)}
              >
                {st.emoji || ''} {st._id}
              </button>
            ))}
          </>
        ) : null}
      </div>

      <div className="feed" id="feedContainer">
        {sort === 'daily' ? (
          <DailyQuestionFeed today={dqToday} onTodayUpdate={(next) => setDqToday(next)} />
        ) : (
          <>
            {initialError ? (
              <div className="error-message text-center" style={{ whiteSpace: 'pre-wrap' }}>
                {initialError}
              </div>
            ) : null}
            {!loading && !initialError && posts.length === 0 ? (
              <div className="text-center" style={{ color: 'var(--text-secondary)', padding: 40 }}>
                {t('no_posts_feed')}
              </div>
            ) : null}
            {posts.map((p) => (
              <PostCard
                key={p._id}
                post={p}
                onPostUpdated={(next) => setPosts((prev) => prev.map((x) => (x._id === next._id ? next : x)))}
                onDeleted={(id) => setPosts((prev) => prev.filter((x) => x._id !== id))}
                commentsOpen={activeCommentsPostId === p._id}
                onCommentsOpenChange={(open, postId) => {
                  if (open) {
                    setActiveCommentsPostId(postId)
                  } else {
                    setActiveCommentsPostId((prev) => (prev === postId ? null : prev))
                  }
                }}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}
