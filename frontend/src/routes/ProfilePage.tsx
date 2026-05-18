import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../api/apiClient'
import { useSession } from '../state/SessionContext'
import type {
  AchievementBadge,
  DailyQuestionHistoryItem,
  MoodGradientMode,
  MoodHeatmapDay,
  MoodSong,
  ProfilePayload,
  PublicUser,
  Theme,
} from '../types'
import { PostCard } from '../components/PostCard'
import { t, getLang } from '../i18n/i18n'
import { setGettingStartedTaskDone } from '../ui/gettingStarted'
import { moodBannerLinearGradient, moodLinearGradient135 } from '../ui/moodGradientStyle'
import { streakLabel } from '../ui/streakLabel'
import { shareProfileUrl } from '../config/site'
import { useToast } from '../ui/toastProvider'

function HeatmapDayDetails({ day, dateStr }: { day: MoodHeatmapDay; dateStr: string }) {
  const emotions = day.emotions || []
  if (emotions.length === 0) return null

  const stats: Record<string, { count: number; emoji: string; color: string }> = {}
  emotions.forEach((e) => {
    if (!stats[e.emotion]) stats[e.emotion] = { count: 0, emoji: e.emoji, color: e.color }
    stats[e.emotion].count++
  })

  const total = emotions.length
  const pieData = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      count: s.count,
      percent: Math.round((s.count / total) * 100),
      color: s.color,
      emoji: s.emoji,
    }))
    .sort((a, b) => b.count - a.count)

  let currentPercent = 0
  const gradientParts = pieData
    .map((p) => {
      const start = currentPercent
      currentPercent += (p.count / total) * 100
      return `${p.color} ${start}% ${currentPercent}%`
    })
    .join(', ')

  return (
    <div id="heatmapDetails" className="heatmap-details">
      <div className="heatmap-details-header">
        {t('mood_calendar')}: {dateStr}
      </div>
      <div className="pie-chart-container">
        <div className="pie-chart" style={{ background: `conic-gradient(${gradientParts})` }} />
        <div className="pie-chart-legend">
          {pieData.map((p) => (
            <div key={p.name} className="legend-item">
              <div className="legend-color" style={{ background: p.color }} />
              <div className="legend-label">
                {p.emoji} {p.name}
              </div>
              <div className="legend-percent">{p.percent}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function userListRows(users: PublicUser[], moodGradientMode: MoodGradientMode, theme: Theme) {
  if (!users || users.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>—</p>
  }
  return (
    <>
      {users.map((u) => {
        const c1 = u.currentColor || '#E0E7FF'
        const c2 = u.currentColor2 || c1 || '#A5B4FC'
        const c3 = u.currentColor3 || c2 || '#6366F1'
        const gradient = moodLinearGradient135(c1, c2, c3, moodGradientMode, theme)
        const emoji = u.currentEmoji || '😐'
        return (
          <a key={u._id} className="user-list-row" href={`#/profile/${encodeURIComponent(u.username)}`}>
            <div className="user-circle user-circle--sm" style={{ background: gradient }}>
              {emoji}
            </div>
            <span className="user-list-name">@{u.username}</span>
          </a>
        )
      })}
    </>
  )
}

function badgeCopy(id: string) {
  const map: Record<string, string> = {
    first_post: t('badge_first_post'),
    seven_days: t('badge_seven_days'),
    supporter_10: t('badge_supporter_10'),
    supported_5: t('badge_supported_5'),
  }
  return map[id] || id
}

function summaryLines(value: string | undefined) {
  return (value || '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => x.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
}

function userMoodSong(user: PublicUser): MoodSong | null {
  const title = (user.moodSongTitle || '').trim()
  const artist = (user.moodSongArtist || '').trim()
  const previewUrl = (user.moodSongPreviewUrl || '').trim()
  const externalUrl = (user.moodSongExternalUrl || '').trim()
  if (!title || !artist || !previewUrl || !externalUrl) return null
  return {
    title,
    artist,
    previewUrl,
    externalUrl,
    artworkUrl: (user.moodSongArtworkUrl || '').trim(),
    source: (user.moodSongSource || '').trim(),
  }
}

function MoodSongCard({ song }: { song: MoodSong }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playError, setPlayError] = useState(false)

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    setPlayError(false)
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlayError(true)
    }
  }

  return (
    <div className="profile-mood-song">
      {song.artworkUrl ? <img className="profile-mood-song__art" src={song.artworkUrl} alt="" loading="lazy" /> : null}
      <div className="profile-mood-song__body">
        <div className="profile-mood-song__label">{t('profile_mood_song_label')}</div>
        <div className="profile-mood-song__title">{song.artist} — {song.title}</div>
        <div className="profile-mood-song__actions">
          <button type="button" className="profile-mood-song__play" onClick={toggle}>
            {playing ? t('profile_mood_song_pause') : t('profile_mood_song_play')}
          </button>
          <a className="profile-mood-song__link" href={song.externalUrl} target="_blank" rel="noreferrer">
            {t('profile_mood_song_open')}
          </a>
        </div>
        <audio ref={audioRef} src={song.previewUrl} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
        {playError ? <div className="profile-mood-song__error">{t('profile_mood_song_error')}</div> : null}
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { username } = useParams()
  const nav = useNavigate()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const s = useSession()
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  )
  const [payload, setPayload] = useState<ProfilePayload | null>(null)
  const [followers, setFollowers] = useState<PublicUser[]>([])
  const [following, setFollowing] = useState<PublicUser[]>([])
  const [heatmap, setHeatmap] = useState<MoodHeatmapDay[]>([])
  const [dailyHistory, setDailyHistory] = useState<DailyQuestionHistoryItem[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [heatmapSelection, setHeatmapSelection] = useState<{ dateStr: string; day: MoodHeatmapDay } | null>(null)
  const heatmapDetailsRef = useRef<HTMLDivElement | null>(null)
  const [userListOpen, setUserListOpen] = useState(false)
  const [userListTab, setUserListTab] = useState<'followers' | 'following'>('followers')

  useEffect(() => {
    document.body.classList.add('profile-bleed-header')
    return () => document.body.classList.remove('profile-bleed-header')
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const f = () => setIsNarrow(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const openFollowersModal = useCallback(() => {
    setUserListTab('followers')
    setUserListOpen(true)
  }, [])
  const openFollowingModal = useCallback(() => {
    setUserListTab('following')
    setUserListOpen(true)
  }, [])

  useEffect(() => {
    if (s.isAuthed && username && s.username && username === s.username) {
      setGettingStartedTaskDone('open_profile')
    }
  }, [s.isAuthed, s.username, username])

  const isOwnProfile = Boolean(s.isAuthed && username && s.username && username === s.username)

  useEffect(() => {
    if (!username) return
    setBusy(true)
    setErr('')
    Promise.all([
      apiFetch<ProfilePayload>(`/users/${encodeURIComponent(username)}`, { auth: true }),
      apiFetch<PublicUser[]>(`/users/${encodeURIComponent(username)}/followers`, { auth: true }),
      apiFetch<PublicUser[]>(`/users/${encodeURIComponent(username)}/following`, { auth: true }),
      apiFetch<MoodHeatmapDay[]>(`/users/${encodeURIComponent(username)}/heatmap`, { auth: true }),
      isOwnProfile
        ? apiFetch<{ answers: DailyQuestionHistoryItem[] }>('/daily-question/me/history?limit=7')
        : Promise.resolve({ answers: [] }),
    ])
      .then(([main, fol, ing, hm, history]) => {
        setPayload(main)
        setFollowers(fol || [])
        setFollowing(ing || [])
        setHeatmap(hm || [])
        setDailyHistory(history.answers || [])
      })
      .catch((e: { message?: string }) => setErr(e?.message || t('profile_load_error')))
      .finally(() => setBusy(false))
  }, [username, isOwnProfile])

  useEffect(() => {
    setHeatmapSelection(null)
  }, [username])

  useEffect(() => {
    if (!userListOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserListOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [userListOpen])

  useEffect(() => {
    if (heatmapSelection && heatmapDetailsRef.current) {
      heatmapDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [heatmapSelection])

  const postScrollId = searchParams.get('post')

  useEffect(() => {
    if (busy || !payload || !postScrollId) return
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`post-${postScrollId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('post')
          return next
        },
        { replace: true },
      )
    }, 120)
    return () => window.clearTimeout(timer)
  }, [busy, payload, postScrollId, setSearchParams])

  const heatmapCells = useMemo(() => {
    const map: Record<string, MoodHeatmapDay> = {}
    heatmap.forEach((d) => {
      map[d._id] = d
    })
    const dayNames =
      getLang() === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    const now = new Date()
    const daysToShow = 6
    const cells: { key: string; color: string; label: string; title: string; dayData: MoodHeatmapDay | null }[] = []
    for (let i = daysToShow; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const dayData = map[key] || null
      const color = dayData ? dayData.dominantColor : 'var(--border-color)'
      cells.push({
        key,
        color,
        label: dayNames[d.getDay()],
        title: key + (dayData ? ` (${dayData.count} posts)` : ' (No posts)'),
        dayData,
      })
    }
    return cells
  }, [heatmap])

  const hero = useMemo(() => {
    if (!payload) return null
    const u = payload.user
    const c1 = u.currentColor || '#E0E7FF'
    const c2 = u.currentColor2 || c1 || '#A5B4FC'
    const c3 = u.currentColor3 || c2 || '#6366F1'
    const gradient = moodLinearGradient135(c1, c2, c3, s.moodGradientMode, s.theme)
    const bannerGradient = moodBannerLinearGradient(c1, c2, c3, s.moodGradientMode, s.theme)
    const emoji = u.currentEmoji || '😐'
    const emotion = u.currentEmotion || 'neutral'
    const isOwn = s.username === u.username
    const showFollow = s.isAuthed && !isOwn && !payload.isFollowing
    const weeklyLines = summaryLines(u.weeklyAiSummary)
    const badges = payload.badges || []
    const moodSong = userMoodSong(u)

    return (
      <div className="profile-hero">
        <div
          className="profile-banner"
          style={{ background: bannerGradient, backgroundSize: '200% 200%' }}
          aria-hidden
        />
        <div className="profile-hero__body">
          <div className="profile-avatar profile-avatar--discord" style={{ background: gradient }}>
            {emoji}
          </div>
          <div className="profile-username">
            @{u.username}
            {typeof payload.activityStreak === 'number' && payload.activityStreak > 0 ? (
              <span className="profile-streak">🔥 {streakLabel(payload.activityStreak, getLang())}</span>
            ) : null}
          </div>
          {isOwn ? (
            <button
              type="button"
              className="profile-share-btn"
              onClick={async () => {
                const url = shareProfileUrl(u.username)
                try {
                  await navigator.clipboard.writeText(url)
                  showToast(t('profile_share_copied'), 'success')
                } catch {
                  showToast(url, 'info')
                }
              }}
            >
              {t('profile_share')}
            </button>
          ) : null}
        <div className="profile-ai-weekly profile-ai-weekly--card" aria-live="polite">
          <div className="profile-ai-weekly-label">{t('profile_weekly_ai_label')}</div>
          {weeklyLines.length ? (
            <ul className="profile-ai-weekly-list">
              {weeklyLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="profile-ai-weekly-empty">{t('profile_weekly_ai_empty')}</div>
          )}
        </div>
        {moodSong ? <MoodSongCard song={moodSong} /> : null}
        {badges.length ? (
          <div className="profile-badges" aria-label={t('profile_badges_title')}>
            {badges.map((badge: AchievementBadge) => (
              <span key={badge.id} className={`profile-badge profile-badge--${badge.level || 'bronze'}`}>
                {badgeCopy(badge.id)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="profile-status-label">
          {t('profile_status')}: {emotion}
        </div>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{payload.posts.length}</div>
            <div className="profile-stat-label">{t('posts_word')}</div>
          </div>
          <button
            type="button"
            className="profile-stat profile-stat--clickable"
            onClick={openFollowersModal}
            aria-haspopup="dialog"
          >
            <div className="profile-stat-value">{payload.followersCount}</div>
            <div className="profile-stat-label">{t('followers')}</div>
          </button>
          <button
            type="button"
            className="profile-stat profile-stat--clickable"
            onClick={openFollowingModal}
            aria-haspopup="dialog"
          >
            <div className="profile-stat-value">{payload.followingCount}</div>
            <div className="profile-stat-label">{t('following')}</div>
          </button>
          <div className="profile-stat">
            <div className="profile-stat-value">{payload.totalLikesReceived}</div>
            <div className="profile-stat-label">{t('likes_on_posts')}</div>
          </div>
        </div>
        {showFollow ? (
          <div className="profile-actions">
            <button
              type="button"
              className="btn-secondary"
              id="profileFollowBtn"
              onClick={async () => {
                const res = await apiFetch<{ isFollowing: boolean; followersCount: number }>(
                  `/users/${encodeURIComponent(u.username)}/follow`,
                  { method: 'POST' },
                )
                setPayload((p) =>
                  p
                    ? {
                        ...p,
                        isFollowing: res.isFollowing,
                        followersCount: res.followersCount,
                      }
                    : p,
                )
              }}
            >
              {t('follow')}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    )
  }, [payload, s.isAuthed, s.username, s.moodGradientMode, s.theme, openFollowersModal, openFollowingModal])

  return (
    <div id="profileView">
      <div className="back-row">
        <button type="button" id="profileBackBtn" onClick={() => nav(-1)}>
          {t('back')}
        </button>
      </div>
      <div id="profileLoader" className={`loader ${busy ? '' : 'hidden'}`}>
        {t('loading_posts')}
      </div>
      <div id="profileContent" className={busy ? 'hidden' : ''}>
        {err ? <p className="error-message text-center">{err}</p> : null}
        {payload && !err ? (
          <>
            {hero}
            {isOwnProfile ? (
              <section className="daily-history-card">
                <div className="daily-history-card__title">{t('daily_history_title')}</div>
                {dailyHistory.length ? (
                  <div className="daily-history-card__list">
                    {dailyHistory.map((item) => (
                      <article key={item.dayKey} className="daily-history-card__item">
                        <div className="daily-history-card__date">{item.dayKey}</div>
                        <div className="daily-history-card__question">{item.question}</div>
                        <p className="daily-history-card__answer">{item.text}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="daily-history-card__empty">{t('daily_history_empty')}</p>
                )}
              </section>
            ) : null}
            <div id="moodHeatmap" className={`heatmap-container ${payload.posts.length ? '' : 'hidden'}`}>
              <div className="heatmap-title">{t('mood_calendar')}</div>
              <div
                id="heatmapGrid"
                className="heatmap-grid"
                style={{
                  marginTop: 10,
                  display: 'flex',
                  justifyContent: 'space-around',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                {heatmapCells.map((c) => {
                  const hasDetails = Boolean(c.dayData && c.dayData.emotions && c.dayData.emotions.length > 0)
                  return (
                    <div
                      key={c.key}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    >
                      <div
                        className="heatmap-cell"
                        style={{
                          background: c.color,
                          width: 24,
                          height: 24,
                          cursor: hasDetails ? 'pointer' : 'default',
                        }}
                        title={c.title}
                        onClick={() => {
                          if (hasDetails && c.dayData) {
                            setHeatmapSelection({ dateStr: c.key, day: c.dayData })
                          } else {
                            setHeatmapSelection(null)
                          }
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', textAlign: 'center', marginTop: 4 }}>{c.label}</div>
                    </div>
                  )
                })}
              </div>
              <div ref={heatmapDetailsRef}>
                {heatmapSelection ? <HeatmapDayDetails day={heatmapSelection.day} dateStr={heatmapSelection.dateStr} /> : null}
              </div>
            </div>
            <div className="feed" id="profilePosts">
              {payload.posts.length === 0 ? (
                <div className="text-center" style={{ color: 'var(--text-secondary)', padding: 24 }}>
                  {t('no_posts_user')}
                </div>
              ) : (
                payload.posts.map((p) => (
                  <PostCard
                    key={p._id}
                    post={p}
                    onPostUpdated={(next) =>
                      setPayload((prev) =>
                        prev
                          ? {
                              ...prev,
                              posts: prev.posts.map((x) => (x._id === next._id ? next : x)),
                            }
                          : prev,
                      )
                    }
                    onDeleted={(id) =>
                      setPayload((prev) =>
                        prev ? { ...prev, posts: prev.posts.filter((x) => x._id !== id) } : prev,
                      )
                    }
                    onCommentsOpenChange={(open, postId) => {
                      if (!isNarrow) return
                      if (open) {
                        requestAnimationFrame(() => {
                          document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        })
                      }
                    }}
                  />
                ))
              )}
            </div>
          </>
        ) : null}
      </div>

      {payload && !err && userListOpen ? (
        <div
          className="profile-follow-modal-overlay"
          role="presentation"
          onClick={() => setUserListOpen(false)}
        >
          <div
            className="profile-follow-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${t('followers')} · ${t('following')}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-follow-modal__top">
              <div className="profile-follow-modal__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`profile-follow-modal__tab ${userListTab === 'followers' ? 'is-active' : ''}`}
                  aria-selected={userListTab === 'followers'}
                  onClick={() => setUserListTab('followers')}
                >
                  {t('followers')}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`profile-follow-modal__tab ${userListTab === 'following' ? 'is-active' : ''}`}
                  aria-selected={userListTab === 'following'}
                  onClick={() => setUserListTab('following')}
                >
                  {t('following')}
                </button>
              </div>
              <button
                type="button"
                className="profile-follow-modal__close"
                onClick={() => setUserListOpen(false)}
                aria-label={t('gs_dismiss')}
              >
                ×
              </button>
            </div>
            <div className="profile-follow-modal__body" role="tabpanel">
              {userListRows(userListTab === 'followers' ? followers : following, s.moodGradientMode, s.theme)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
