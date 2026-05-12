import { Link } from 'react-router-dom'
import { useSession } from '../state/SessionContext'

export function Sidebar() {
  const s = useSession()
  return (
    <div className="sidebar">
      <div className="sidebar-card">
        <div className="sidebar-title">Profile</div>
        <div className="sidebar-body">
          {s.isAuthed && s.username ? (
            <>
              <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>@{s.username}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to={`/profile/${encodeURIComponent(s.username)}`} className="sidebar-link">
                  Open profile
                </Link>
                <button type="button" className="btn" onClick={s.logout}>
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link to="/register" className="sidebar-link">
              Sign in / Register
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

