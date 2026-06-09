import { Outlet } from 'react-router-dom'

/** Wrapper with display:contents (see motion-polish.css) so main grid layout is preserved. */
export function PageTransition() {
  return (
    <div className="page-transition">
      <Outlet />
    </div>
  )
}
