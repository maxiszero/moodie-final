import { useRef, useState } from 'react'
import type { MoodSong } from '../types'
import { t } from '../i18n/i18n'

export function MoodSongPreview({ song, compact }: { song: MoodSong; compact?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    try {
      await audio.play()
      setPlaying(true)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`post-mood-song${compact ? ' post-mood-song--compact' : ''}`}>
      {song.artworkUrl ? <img className="post-mood-song__art" src={song.artworkUrl} alt="" loading="lazy" /> : null}
      <div className="post-mood-song__meta">
        <span className="post-mood-song__track">
          {song.artist} — {song.title}
        </span>
      </div>
      <button type="button" className="post-mood-song__play" onClick={() => void toggle()} aria-label={t('profile_mood_song_play')}>
        {playing ? t('profile_mood_song_pause') : t('profile_mood_song_play')}
      </button>
      <audio
        ref={audioRef}
        src={song.previewUrl}
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </div>
  )
}

export function moodSongFromPost(post: {
  moodSongTitle?: string
  moodSongArtist?: string
  moodSongPreviewUrl?: string
  moodSongExternalUrl?: string
  moodSongArtworkUrl?: string
}): MoodSong | null {
  const title = (post.moodSongTitle || '').trim()
  const artist = (post.moodSongArtist || '').trim()
  const previewUrl = (post.moodSongPreviewUrl || '').trim()
  const externalUrl = (post.moodSongExternalUrl || '').trim()
  if (!title || !artist || !previewUrl) return null
  return {
    title,
    artist,
    previewUrl,
    externalUrl: externalUrl || previewUrl,
    artworkUrl: (post.moodSongArtworkUrl || '').trim(),
  }
}
