import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import { AppFooter } from './AppFooter'

export function AppLayout() {
  return (
    <div>
      <AppHeader />
      <main>
        <div />
        <div id="homeView" className="main-content">
          <Outlet />
        </div>
        <aside className="sidebar" id="sidebar">
          <Sidebar />
        </aside>
      </main>
      <AppFooter />
    </div>
  )
}

