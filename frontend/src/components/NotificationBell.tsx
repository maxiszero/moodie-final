import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../i18n/i18n'
import {
  clearNotifications,
  loadNotifications,
  markAllRead,
  markRead,
  type StoredNotification,
  unreadCount,
} from '../ui/notificationCenter'

function bellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  )
}

export function NotificationBell() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<StoredNotification[]>(() => loadNotifications())
  const [unread, setUnread] = useState(() => unreadCount())
  const rootRef = useRef<HTMLDivElement>(null)

  const refresh = () => {
    setItems(loadNotifications())
    setUnread(unreadCount())
  }

  useEffect(() => {
    const onStorage = () => refresh()
    window.addEventListener('moodie:notifications', onStorage)
    return () => window.removeEventListener('moodie:notifications', onStorage)
  }, [])

  useEffect(() => {
    if (!open) return
    markAllRead()
    refresh()
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onPick = (n: StoredNotification) => {
    markRead(n.id)
    refresh()
    setOpen(false)
    if (n.href) nav(n.href.replace(/^#/, ''))
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="notif-bell__btn"
        aria-label={t('notif_bell_aria')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {bellIcon()}
        {unread > 0 ? <span className="notif-bell__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="notif-bell__panel" role="dialog" aria-label={t('notif_panel_title')}>
          <div className="notif-bell__head">
            <span>{t('notif_panel_title')}</span>
            {items.length ? (
              <button type="button" className="notif-bell__clear" onClick={() => { clearNotifications(); refresh() }}>
                {t('notif_clear')}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="notif-bell__empty">{t('notif_empty')}</p>
          ) : (
            <ul className="notif-bell__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className="notif-bell__item" onClick={() => onPick(n)}>
                    <span className="notif-bell__msg">{n.message}</span>
                    {n.createdAt ? (
                      <span className="notif-bell__time">{new Date(n.createdAt).toLocaleString()}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
