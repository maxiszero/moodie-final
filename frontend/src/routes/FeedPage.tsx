import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiFetch } from '../api/apiClient'
import { API_URL } from '../config/apiUrl'
import { useSession } from '../state/SessionContext'
import type { DailyQuestionToday, Post } from '../types'
import { useRealtime } from '../realtime/RealtimeContext'
import { PostCard } from '../components/PostCard'
import { DailyQuestionFeed } from '../components/DailyQuestionFeed'
import { MoodStatsPanel } from '../components/MoodStatsPanel'
import { MoodWeekWidget } from '../components/MoodWeekWidget'
import { useFeedMood } from '../state/FeedMoodContext'
import { t, getLang } from '../i18n/i18n'
import { applyTheme } from '../ui/theme'
import { setGettingStartedTaskDone } from '../ui/gettingStarted'
import { useToast } from '../ui/toastProvider'
import { moodLinearGradient135 } from '../ui/moodGradientStyle'
import { storageKeys } from '../config/storage'
import { usePullToRefresh } from '../ui/usePullToRefresh'

function textHasLink(s: string) {
  return /(https?:\/\/\S+|www\.\S+)/i.test(s)
}

type MoodSongPickPayload = {
  moodSongTitle: string
  moodSongArtist: string
  moodSongPreviewUrl: string
  moodSongExternalUrl: string
  moodSongArtworkUrl?: string
  moodSongSource?: string
}

type FeedPageProps = { guestLenta?: boolean }

export function FeedPage({ guestLenta }: FeedPageProps) {
  const s = useSession()
  const loc = useLocation()
  const rt = useRealtime()
  const { showToast } = useToast()
  const { emotionFilter, setEmotionFilter, stats, refetchStats } = useFeedMood()

  const [posts, setPosts] = useState<Post[]>([])
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null)
  const [sort, setSort] = useState<'latest' | 'trending' | 'daily' | 'following' | 'for_you'>('latest')
  const [hasFollowing, setHasFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
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

  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(storageKeys.postDraft) || ''
    } catch {
      return ''
    }
  })
  const [aiTipOpen, setAiTipOpen] = useState(false)
  const [aiTipText, setAiTipText] = useState('')
  const [postBusy, setPostBusy] = useState(false)
  const [aiTipBusy, setAiTipBusy] = useState(false)
  const [songPickOpen, setSongPickOpen] = useState(false)
  const [songPickCandidates, setSongPickCandidates] = useState<MoodSongPickPayload[]>([])
  const [songPickSelectedKey, setSongPickSelectedKey] = useState('')
  const [pendingPostText, setPendingPostText] = useState('')
  const [songPreviewPlaying, setSongPreviewPlaying] = useState<string | null>(null)
  const songPickAudioRef = useRef<HTMLAudioElement | null>(null)

  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const prependOkRef = useRef(true)
  const aiTipCacheRef = useRef<Map<string, { tip: string; at: number }>>(new Map())
  const aiTipTimerRef = useRef<number | null>(null)
  const aiTipAbortRef = useRef<AbortController | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const draftToastShownRef = useRef(false)

  useEffect(() => {
    if (!s.isAuthed || draftToastShownRef.current) return
    try {
      const draft = localStorage.getItem(storageKeys.postDraft)
      if (draft?.trim()) {
        draftToastShownRef.current = true
        showToast(t('post_draft_restored'), 'info')
      }
    } catch {
      /* ignore */
    }
  }, [s.isAuthed, showToast])

  useEffect(() => {
    if (!s.isAuthed) return
    const timer = window.setTimeout(() => {
      try {
        const draft = text.trim()
        if (draft) localStorage.setItem(storageKeys.postDraft, draft)
        else localStorage.removeItem(storageKeys.postDraft)
      } catch {
        /* ignore */
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [s.isAuthed, text])

  useEffect(() => {
    const tab = new URLSearchParams(loc.search).get('tab')
    if (tab === 'daily') setSort('daily')
  }, [loc.search])

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
        if (emotionFilter && sort !== 'following' && sort !== 'for_you') url += `&emotion=${encodeURIComponent(emotionFilter)}`
        if (moodMix && s.isAuthed && !emotionFilter && sort !== 'following' && sort !== 'for_you') url += `&moodMix=1`
        const data = await apiFetch<Post[]>(url, { auth: s.isAuthed })
        if (!Array.isArray(data)) throw new Error('Invalid response')

        hasMoreRef.current = data.length >= 10
        setHasMore(data.length >= 10)

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
    if (sort !== 'following' || !s.isAuthed || !s.username) {
      setHasFollowing(null)
      return
    }
    let alive = true
    apiFetch<{ username: string }[]>(`/users/${encodeURIComponent(s.username)}/following`, { auth: true })
      .then((rows) => {
        if (alive) setHasFollowing(Array.isArray(rows) && rows.length > 0)
      })
      .catch(() => {
        if (alive) setHasFollowing(null)
      })
    return () => {
      alive = false
    }
  }, [sort, s.isAuthed, s.username])

  const refreshFeed = useCallback(async () => {
    if (sort === 'daily') {
      await loadDqToday()
      return
    }
    pageRef.current = 1
    hasMoreRef.current = true
    setHasMore(true)
    prependOkRef.current = true
    setPosts([])
    await loadPosts(true)
    refetchStats()
  }, [loadDqToday, loadPosts, refetchStats, sort])

  const { pullOffset, pullActive } = usePullToRefresh({
    enabled: !guestLenta,
    onRefresh: refreshFeed,
  })

  useEffect(() => {
    if (sort === 'daily') return
    pageRef.current = 1
    hasMoreRef.current = true
    setHasMore(true)
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
    if (sort === 'daily' || sort === 'following' || sort === 'for_you') return
    pageRef.current = 1
    hasMoreRef.current = true
    setHasMore(true)
    setPosts([])
    prependOkRef.current = true
    void loadPosts(true)
  }, [moodMix])

  useEffect(() => {
    if (sort === 'daily') return
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const onNearEnd = () => {
      if (loadingRef.current || !hasMoreRef.current) return
      void loadPosts(false)
    }

    if (typeof IntersectionObserver === 'undefined') {
      const onScroll = () => {
        const root = document.scrollingElement ?? document.documentElement
        const { scrollTop, scrollHeight, clientHeight } = root
        if (scrollTop + clientHeight >= scrollHeight - 320) onNearEnd()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onNearEnd()
      },
      { root: null, rootMargin: '320px 0px', threshold: 0 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [loadPosts, sort, hasMore, posts.length])

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
  const canSubmit = Boolean(
    s.isAuthed && text.trim() && !overLimit && !textHasLink(text) && !songPickOpen,
  )

  useEffect(() => {
    if (!songPickOpen) {
      const a = songPickAudioRef.current
      if (a) {
        a.pause()
        setSongPreviewPlaying(null)
      }
    }
  }, [songPickOpen])
  const myGradient = useMemo(
    () => moodLinearGradient135(s.mood.color, s.mood.color2, s.mood.color3, s.moodGradientMode, s.theme),
    [s.mood.color, s.mood.color2, s.mood.color3, s.moodGradientMode, s.theme],
  )

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

  const toggleSongPickPreview = (previewUrl: string) => {
    const el = songPickAudioRef.current
    if (!el || !previewUrl) return
    if (songPreviewPlaying === previewUrl) {
      el.pause()
      setSongPreviewPlaying(null)
      return
    }
    el.src = previewUrl
    void el
      .play()
      .then(() => setSongPreviewPlaying(previewUrl))
      .catch(() => setSongPreviewPlaying(null))
  }

  const closeSongPickModal = () => {
    setSongPickOpen(false)
    setPendingPostText('')
    setSongPickCandidates([])
    setSongPickSelectedKey('')
  }

  const applyPublishSuccess = async (newPost: Post) => {
    setText('')
    try {
      localStorage.removeItem(storageKeys.postDraft)
    } catch {
      /* ignore */
    }
    setAiTipOpen(false)
    setAiTipText('')
    closeSongPickModal()
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
    showToast(t('post_published'), 'success')
    await s.refreshMe()
    await refetchStats()
  }

  return (
    <>
      {pullActive ? (
        <div className="feed-pull-hint" style={{ transform: `translateY(${Math.min(pullOffset, 48)}px)` }}>
          {t('feed_pull_hint')}
        </div>
      ) : null}
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

      {showCreatePost ? <MoodWeekWidget /> : null}

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
                  showToast(t('ai_tip_alert'), 'info')
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
                  showToast(t('no_links'), 'error')
                  return
                }
                setPostBusy(true)
                try {
                  let suggest: { songs?: MoodSongPickPayload[] } = { songs: [] }
                  try {
                    suggest = await apiFetch<{ songs?: MoodSongPickPayload[] }>('/mood-song/suggest', {
                      method: 'POST',
                      body: JSON.stringify({ text: content, limit: 8 }),
                    })
                  } catch {
                    suggest = { songs: [] }
                  }
                  const songs = Array.isArray(suggest.songs) ? suggest.songs : []
                  if (songs.length === 0) {
                    showToast(t('mood_song_picker_no_tracks'), 'info')
                    const newPost = await apiFetch<Post>('/posts', {
                      method: 'POST',
                      body: JSON.stringify({ text: content }),
                    })
                    await applyPublishSuccess(newPost)
                    return
                  }
                  setPendingPostText(content)
                  setSongPickCandidates(songs)
                  setSongPickSelectedKey(songs[0]?.moodSongPreviewUrl || '')
                  setSongPickOpen(true)
                } catch (e: unknown) {
                  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'fail'
                  showToast(msg, 'error')
                } finally {
                  setPostBusy(false)
                }
              }}
            >
              {postBusy ? t('publishing') : t('post')}
            </button>
          </div>
          <div className="composer-footnote" aria-live="polite">
            {textHasLink(text) ? t('composer_no_links_hint') : t('composer_hint')}
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

      <div className="feed-tabs feed-tabs--scroll" role="tablist" aria-label={t('feed_tabs_label')}>
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
          className={`feed-tab ${sort === 'following' ? 'active' : ''}`}
          data-sort="following"
          role="tab"
          aria-selected={sort === 'following'}
          id="tabFollowing"
          onClick={() => setSort('following')}
        >
          {t('tab_following')}
        </button>
        <button
          type="button"
          className={`feed-tab ${sort === 'for_you' ? 'active' : ''}`}
          data-sort="for_you"
          role="tab"
          aria-selected={sort === 'for_you'}
          id="tabForYou"
          onClick={() => setSort('for_you')}
        >
          {t('tab_for_you')}
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

      {!guestLenta && sort !== 'daily' && sort !== 'following' && sort !== 'for_you' ? (
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

      <div id="moodFilters" className={`mood-filters ${sort === 'daily' || sort === 'following' || sort === 'for_you' ? 'hidden' : ''}`}>
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

      {songPickOpen ? (
        <div
          className="profile-follow-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="moodSongPickTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget && !postBusy) closeSongPickModal()
          }}
        >
          <div className="mood-song-pick-modal" onClick={(e) => e.stopPropagation()}>
            <audio
              ref={songPickAudioRef}
              style={{ display: 'none' }}
              onEnded={() => setSongPreviewPlaying(null)}
            />
            <div className="mood-song-pick-modal__head">
              <div className="mood-song-pick-modal__titles">
                <h2 id="moodSongPickTitle">{t('mood_song_pick_title')}</h2>
                <p>{t('mood_song_pick_sub')}</p>
              </div>
              <button
                type="button"
                className="profile-follow-modal__close"
                disabled={postBusy}
                onClick={() => closeSongPickModal()}
                aria-label={t('mood_song_pick_cancel')}
              >
                ×
              </button>
            </div>
            <div className="mood-song-pick-modal__body">
              {songPickCandidates.map((song) => {
                const key = song.moodSongPreviewUrl
                const selected = songPickSelectedKey === key
                return (
                  <label
                    key={key}
                    className={`mood-song-pick-row ${selected ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="moodSongPick"
                      checked={selected}
                      onChange={() => setSongPickSelectedKey(key)}
                    />
                    <div className="mood-song-pick-row__main">
                      <div className="mood-song-pick-row__title">{song.moodSongTitle}</div>
                      <div className="mood-song-pick-row__artist">{song.moodSongArtist}</div>
                    </div>
                    <button
                      type="button"
                      className="mood-song-pick-preview-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggleSongPickPreview(key)
                      }}
                    >
                      {songPreviewPlaying === key ? t('mood_song_pick_preview_stop') : t('mood_song_pick_preview')}
                    </button>
                  </label>
                )
              })}
            </div>
            <div className="mood-song-pick-modal__foot">
              <button
                type="button"
                className="btn-secondary"
                disabled={postBusy}
                onClick={async () => {
                  setPostBusy(true)
                  try {
                    const newPost = await apiFetch<Post>('/posts', {
                      method: 'POST',
                      body: JSON.stringify({ text: pendingPostText }),
                    })
                    await applyPublishSuccess(newPost)
                  } catch (e: unknown) {
                    const msg =
                      e && typeof e === 'object' && 'message' in e
                        ? String((e as { message: string }).message)
                        : 'fail'
                    showToast(msg, 'error')
                  } finally {
                    setPostBusy(false)
                  }
                }}
              >
                {t('mood_song_pick_skip')}
              </button>
              <button type="button" className="btn-secondary" disabled={postBusy} onClick={() => closeSongPickModal()}>
                {t('mood_song_pick_cancel')}
              </button>
              <button
                type="button"
                className="auth-btn"
                disabled={postBusy || !songPickSelectedKey}
                onClick={async () => {
                  const sel = songPickCandidates.find((s) => s.moodSongPreviewUrl === songPickSelectedKey)
                  if (!sel) return
                  setPostBusy(true)
                  try {
                    const newPost = await apiFetch<Post>('/posts', {
                      method: 'POST',
                      body: JSON.stringify({ text: pendingPostText, moodSong: sel }),
                    })
                    await applyPublishSuccess(newPost)
                  } catch (e: unknown) {
                    const msg =
                      e && typeof e === 'object' && 'message' in e
                        ? String((e as { message: string }).message)
                        : 'fail'
                    showToast(msg, 'error')
                  } finally {
                    setPostBusy(false)
                  }
                }}
              >
                {postBusy ? t('publishing') : t('mood_song_pick_confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <div className="feed-empty-state">
                {sort === 'following' ? (
                  !s.isAuthed ? (
                    <p>{t('feed_following_login')}</p>
                  ) : hasFollowing === false ? (
                    <>
                      <p>{t('feed_following_empty')}</p>
                      <Link className="auth-btn feed-empty-state__cta" to="/search">
                        {t('feed_following_empty_cta')}
                      </Link>
                    </>
                  ) : (
                    <p>{t('feed_following_no_posts')}</p>
                  )
                ) : sort === 'for_you' ? (
                  !s.isAuthed ? (
                    <>
                      <p>{t('feed_for_you_login')}</p>
                      <Link className="auth-btn feed-empty-state__cta" to="/register">
                        {t('feed_for_you_login_cta')}
                      </Link>
                    </>
                  ) : (
                    <p>{t('feed_for_you_empty')}</p>
                  )
                ) : (
                  <p>{t('no_posts_feed')}</p>
                )}
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
            {posts.length > 0 && hasMore ? (
              <div ref={loadMoreRef} className="feed-load-sentinel" aria-hidden />
            ) : null}
            {loading && posts.length > 0 ? (
              <div className="loader feed-load-more">{t('loading_posts')}</div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
