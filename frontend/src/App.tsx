import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './layout/AppHeader'
import { AppFooter } from './layout/AppFooter'
import { useSession } from './state/SessionContext'
import { FeedMoodProvider } from './state/FeedMoodContext'
import { lazy, Suspense, useEffect, useState } from 'react'
import { WelcomeModal } from './components/WelcomeModal'
import { Onboarding } from './components/Onboarding'
import { storageKeys } from './config/storage'
import { GettingStartedModal } from './components/GettingStartedModal'
import { GettingStartedWidget } from './components/GettingStartedWidget'
import { AddToHomeHint } from './components/AddToHomeHint'
import { Seo } from './components/Seo'
import { AppMobileNav } from './layout/AppMobileNav'
import { prefetchFitRewardSlot } from './config/fitRewardUrl'

const FeedPage = lazy(() => import('./routes/FeedPage').then(({ FeedPage }) => ({ default: FeedPage })))
const SettingsPage = lazy(() => import('./routes/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage })))
const AdminPage = lazy(() => import('./routes/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })))
const ProfilePage = lazy(() => import('./routes/ProfilePage').then(({ ProfilePage }) => ({ default: ProfilePage })))
const AuthPage = lazy(() => import('./routes/AuthPage').then(({ AuthPage }) => ({ default: AuthPage })))
const GettingStartedPage = lazy(() =>
  import('./routes/GettingStartedPage').then(({ GettingStartedPage }) => ({ default: GettingStartedPage })),
)
const TestsHubPage = lazy(() => import('./routes/tests/TestsHubPage').then(({ TestsHubPage }) => ({ default: TestsHubPage })))
const EmotionTestPage = lazy(() =>
  import('./routes/tests/EmotionTestPage').then(({ EmotionTestPage }) => ({ default: EmotionTestPage })),
)
const MbtiTestPage = lazy(() => import('./routes/tests/MbtiTestPage').then(({ MbtiTestPage }) => ({ default: MbtiTestPage })))
const SearchPage = lazy(() => import('./routes/SearchPage').then(({ SearchPage }) => ({ default: SearchPage })))

function AppShell() {
  const s = useSession()
  const loc = useLocation()
  const authOnly = !s.isAuthed && loc.pathname === '/'

  if (authOnly) {
    return (
      <div id="authView">
        <Outlet />
      </div>
    )
  }

  return (
    <>
      <AppHeader />
      <main>
        <Outlet />
      </main>
      <AppMobileNav />
      <AppFooter />
    </>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const s = useSession()
  if (!s.isAuthed) return <Navigate to="/" replace />
  return <>{children}</>
}

function FeedHome() {
  const s = useSession()
  if (!s.isAuthed) return <AuthPage />
  return (
    <FeedMoodProvider>
      <div id="homeView" className="main-content">
        <FeedPage />
      </div>
      <aside className="sidebar" id="sidebar">
        <GettingStartedWidget compactLink />
        <AddToHomeHint />
      </aside>
    </FeedMoodProvider>
  )
}

function FeedLenta() {
  return (
    <FeedMoodProvider>
      <div id="homeView" className="main-content">
        <FeedPage guestLenta />
      </div>
      <aside className="sidebar" id="sidebar">
        <GettingStartedWidget compactLink />
        <AddToHomeHint />
      </aside>
    </FeedMoodProvider>
  )
}

function TestsShell() {
  return (
    <div id="testsView" className="main-content tests-shell">
      <Outlet />
    </div>
  )
}

export default function App() {
  const s = useSession()
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [gettingStartedOpen, setGettingStartedOpen] = useState(false)

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(storageKeys.hasSeenOnboarding)
    if (!hasSeenOnboarding) setOnboardingOpen(true)

    const hasSeenWelcome = localStorage.getItem(storageKeys.welcomeSeen)
    if (!hasSeenWelcome) setWelcomeOpen(true)
  }, [])

  useEffect(() => {
    void prefetchFitRewardSlot()
  }, [])

  useEffect(() => {
    if (!s.isAuthed) return
    const seen = localStorage.getItem(storageKeys.gettingStartedSeen)
    const just = localStorage.getItem(storageKeys.justRegistered)
    if (!seen && just) {
      setGettingStartedOpen(true)
    }
  }, [s.isAuthed])

  return (
    <HashRouter>
      <Seo />
      <Suspense fallback={<div className="main-content" aria-live="polite" />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<FeedHome />} />
            <Route path="/lenta" element={<FeedLenta />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route path="/tests" element={<TestsShell />}>
              <Route index element={<TestsHubPage />} />
              <Route path="emotions" element={<EmotionTestPage />} />
              <Route path="mbti" element={<MbtiTestPage />} />
            </Route>
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/getting-started"
              element={
                <RequireAuth>
                  <GettingStartedPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPage />
                </RequireAuth>
              }
            />
            <Route path="/profile/:username" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <WelcomeModal open={welcomeOpen} onClose={() => setWelcomeOpen(false)} />
      <Onboarding
        open={onboardingOpen}
        onDone={() => {
          setOnboardingOpen(false)
          document.body.classList.remove('onboarding-active')
        }}
      />
      <GettingStartedModal open={gettingStartedOpen} onClose={() => setGettingStartedOpen(false)} />
    </HashRouter>
  )
}
