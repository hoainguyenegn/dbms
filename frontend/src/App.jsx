import { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import AuthModal from './components/AuthModal'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import SystemStatus from './pages/SystemStatus'
import BookingPage from './pages/BookingPage'
import ReservationPage from './pages/ReservationPage'
import AdminEventsPage from './pages/AdminEventsPage'

export default function App() {
  const [currentPage, setCurrentPage] = useState('home') // 'home' | 'auth' | 'system' | 'admin'

  return (
    <AuthProvider>
      <div className="app-container">
        {window.location.pathname === '/reserve' ? <ReservationPage /> : ['/checkout', '/my-tickets'].includes(window.location.pathname) ? <BookingPage /> : <>
        {currentPage === 'home' && (
          <HomePage
            onOpenAuthPage={() => setCurrentPage('auth')}
            onOpenSystemStatus={() => setCurrentPage('system')}
            onOpenAdminEvents={() => setCurrentPage('admin')}
          />
        )}
        {currentPage === 'auth' && (
          <AuthPage onBackToHome={() => setCurrentPage('home')} />
        )}
        {currentPage === 'system' && (
          <SystemStatus />
        )}
        {currentPage === 'admin' && (
          <AdminEventsPage onBackToHome={() => setCurrentPage('home')} />
        )}

        </>}
        {/* Modal Auth toàn cục xuất hiện khi bấm Đăng nhập / Đăng ký */}
        <AuthModal />
      </div>
    </AuthProvider>
  )
}
