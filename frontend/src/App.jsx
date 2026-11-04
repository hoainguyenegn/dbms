import { AuthProvider } from './context/AuthContext'
import AuthModal from './components/AuthModal'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import SystemStatus from './pages/SystemStatus'
import BookingPage from './pages/BookingPage'
import ReservationPage from './pages/ReservationPage'
import AdminEventsPage from './pages/AdminEventsPage'
import './App.css'

const goHome = () => window.location.assign('/')

export default function App() {
  // Real URLs preserve the destination on refresh, browser Back/Forward and copied links.
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  let page
  switch (path) {
    case '/':
      page = <HomePage onOpenAdminEvents={() => window.location.assign('/admin/events')} />
      break
    case '/reserve': page = <ReservationPage />; break
    case '/checkout':
    case '/my-tickets': page = <BookingPage />; break
    case '/admin/events': page = <AdminEventsPage onBackToHome={goHome} />; break
    case '/account': page = <AuthPage onBackToHome={goHome} />; break
    case '/system': page = <SystemStatus />; break
    default:
      page = <main className="site-not-found"><h1>Không tìm thấy trang</h1><p>Đường dẫn này không còn khả dụng.</p><a className="btn-primary" href="/">Khám phá sự kiện</a></main>
  }
  return <AuthProvider>
    <div className="site-shell">
      <SiteHeader currentPath={path} />
      <div className="site-content">{page}</div>
      <SiteFooter />
    </div>
    <AuthModal />
  </AuthProvider>
}
