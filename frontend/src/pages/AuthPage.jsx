import { useAuth } from '../context/useAuth'
import AuthForm from '../components/AuthForm'
export default function AuthPage({ onBackToHome }) {
  const { user, logout } = useAuth()
  return <main style={{ minHeight: '80vh', padding: '48px 16px', display: 'grid', placeItems: 'center' }}>
    <div className="auth-modal">
      <button type="button" className="auth-close-btn" onClick={onBackToHome} aria-label="Về trang chủ">×</button>
      {user ? <div className="auth-form"><h2>Tài khoản của tôi</h2><p>{user.fullName}</p><p>{user.email}</p>
        <button className="auth-submit-btn" onClick={onBackToHome}>Về trang chủ</button><button className="auth-footer-link" onClick={logout}>Đăng xuất</button>
      </div> : <AuthForm onSuccess={onBackToHome} />}
    </div>
  </main>
}
