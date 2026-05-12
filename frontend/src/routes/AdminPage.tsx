import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/apiClient'
import { useSession } from '../state/SessionContext'
import type { AdminUserRow, Post } from '../types'
import { t, getLang } from '../i18n/i18n'

function formatAdminDate(iso: string | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(getLang() === 'en' ? 'en-US' : 'ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

function ipCell(v: string | undefined) {
  const s = v?.trim()
  return s || '—'
}

/** `typeof null === 'object'` — must guard before reading `.username` */
function postAuthorLabel(userId: Post['userId']) {
  if (userId != null && typeof userId === 'object' && 'username' in userId) {
    return `@${userId.username}`
  }
  return '—'
}

export function AdminPage() {
  const s = useSession()
  const nav = useNavigate()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!s.isAuthed || s.role !== 'admin') return
    setErr('')
    Promise.all([apiFetch<AdminUserRow[]>('/admin/users'), apiFetch<Post[]>('/admin/posts')])
      .then(([u, p]) => {
        setUsers(u || [])
        setPosts(p || [])
      })
      .catch((e: { message?: string }) => setErr(e?.message || 'Failed to load admin data'))
  }, [s.isAuthed, s.role])

  if (!s.isAuthed) return <Navigate to="/" replace />
  if (s.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div id="adminView" className="admin-view">
      <div className="back-row">
        <button type="button" id="adminBackBtn" onClick={() => nav(-1)}>
          {t('back')}
        </button>
      </div>
      <h1 className="page-title" id="adminPageTitle">
        {t('admin_title')}
      </h1>
      <div id="adminLoader" className="loader hidden" />
      <div id="adminContent">
        {err ? <div className="error-message">{err}</div> : null}
        <div className="admin-section">
          <h2 id="adminUsersTitle">{t('admin_users')}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--users" id="adminUsersTable">
              <thead>
                <tr>
                  <th id="thUser">{t('admin_col_user')}</th>
                  <th id="thRegistered">{t('admin_col_registered')}</th>
                  <th id="thIpReg">{t('admin_col_ip_signup')}</th>
                  <th id="thIpLast">{t('admin_col_ip_last')}</th>
                  <th id="thRole">{t('admin_col_role')}</th>
                  <th id="thBan">{t('admin_col_ban')}</th>
                </tr>
              </thead>
              <tbody id="adminUsersBody">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td data-label={t('admin_col_user')}>@{u.username}</td>
                    <td className="admin-table__mono" data-label={t('admin_col_registered')}>
                      {formatAdminDate(u.createdAt)}
                    </td>
                    <td className="admin-table__mono" data-label={t('admin_col_ip_signup')}>
                      {ipCell(u.registrationIp)}
                    </td>
                    <td className="admin-table__mono" data-label={t('admin_col_ip_last')}>
                      {ipCell(u.lastIp)}
                    </td>
                    <td data-label={t('admin_col_role')}>{u.role || t('admin_role_user')}</td>
                    <td className="admin-table__cell--action" data-label={t('admin_col_ban')}>
                      <button
                        type="button"
                        className="auth-btn admin-table__btn"
                        onClick={async () => {
                          const next = !u.banned
                          await apiFetch(`/admin/users/${u._id}/ban`, {
                            method: 'PATCH',
                            body: JSON.stringify({ banned: next }),
                          })
                          setUsers((prev) =>
                            prev.map((x) => (x._id === u._id ? { ...x, banned: next } : x)),
                          )
                        }}
                      >
                        {u.banned ? t('admin_unban') : t('admin_ban')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="admin-section">
          <h2 id="adminPostsTitle">{t('admin_posts')}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--posts" id="adminPostsTable">
              <thead>
                <tr>
                  <th id="thAuthor">{t('admin_col_author')}</th>
                  <th id="thText">{t('admin_col_text')}</th>
                  <th id="thDel">{t('admin_col_action')}</th>
                </tr>
              </thead>
              <tbody id="adminPostsBody">
                {posts.map((p) => (
                  <tr key={p._id}>
                    <td data-label={t('admin_col_author')}>{postAuthorLabel(p.userId)}</td>
                    <td className="admin-table__post-text" data-label={t('admin_col_text')}>
                      {p.text}
                    </td>
                    <td className="admin-table__cell--action" data-label={t('admin_col_action')}>
                      <button
                        type="button"
                        className="auth-btn btn-danger admin-table__btn"
                        onClick={async () => {
                          if (!confirm(t('delete_confirm_post'))) return
                          await apiFetch(`/posts/${p._id}`, { method: 'DELETE' })
                          setPosts((prev) => prev.filter((x) => x._id !== p._id))
                        }}
                      >
                        {t('delete_post')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
