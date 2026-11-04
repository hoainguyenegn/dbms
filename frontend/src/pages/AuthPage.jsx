import { useAuth } from '../context/useAuth'
import AuthForm from '../components/AuthForm'
import '../components/Auth.css'

export default function AuthPage({ onBackToHome }) {
  const { user, logout, loading } = useAuth()
  return <main className="auth-page">
    <section className="auth-card" aria-label="Tài khoản EventBox">
      {loading ? <p className="account-loading" role="status">Đang kiểm tra tài khoản...</p> : user ? <div className="account-summary">
        <span className="account-avatar" aria-hidden="true">{user.fullName?.charAt(0).toUpperCase() || 'E'}</span>
        <h1>Tài khoản của tôi</h1><p>{user.fullName}</p><p className="account-email">{user.email}</p>
        <button type="button" className="auth-submit-btn" onClick={onBackToHome}>Khám phá sự kiện</button>
        <button type="button" className="auth-footer-link" onClick={logout}>Đăng xuất</button>
      </div> : <AuthForm onSuccess={onBackToHome} />}
    </section>
  </main>
}
