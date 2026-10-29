import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import '../components/Auth.css'

export default function AuthPage({ defaultTab = 'login', onBackToHome }) {
  const {
    login,
    sendRegisterOtp,
    verifyRegisterOtp,
    completeRegisterWithPassword,
    isAuthenticated,
    user,
    logout,
  } = useAuth()

  const [tab, setTab] = useState(defaultTab)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // 3-step OTP Register state
  const [registerStep, setRegisterStep] = useState(1)
  const [regFullName, setRegFullName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regOtp, setRegOtp] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Vui lòng nhập Email và mật khẩu.')
      return
    }

    setLoading(true)
    const result = await login(loginEmail.trim(), loginPassword)
    setLoading(false)

    if (!result.success) {
      setErrorMsg(result.message)
    } else {
      setSuccessMsg('Đăng nhập thành công!')
      if (onBackToHome) onBackToHome()
    }
  }

  // Bước 1: Gửi OTP
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!regEmail.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setErrorMsg('Địa chỉ email không đúng định dạng.')
      return
    }

    setLoading(true)
    const res = await sendRegisterOtp(regEmail.trim(), regFullName.trim())
    setLoading(false)

    if (!res.success) {
      setErrorMsg(res.message)
    } else {
      setSuccessMsg(res.message)
      if (res.preview_url) setPreviewUrl(res.preview_url)
      setRegisterStep(2)
    }
  }

  // Bước 2: Xác thực OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!regOtp.trim()) {
      setErrorMsg('Vui lòng nhập mã OTP.')
      return
    }

    setLoading(true)
    const res = await verifyRegisterOtp(regEmail.trim(), regOtp.trim())
    setLoading(false)

    if (!res.success) {
      setErrorMsg(res.message)
    } else {
      setVerificationToken(res.verificationToken)
      setSuccessMsg('Xác thực email thành công! Mời bạn tạo mật khẩu đăng nhập.')
      setRegisterStep(3)
    }
  }

  // Bước 3: Tạo mật khẩu
  const handleCompleteRegister = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!regPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu.')
      return
    }

    if (regPassword.length < 6) {
      setErrorMsg('Mật khẩu tối thiểu 6 ký tự.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.')
      return
    }

    setLoading(true)
    const res = await completeRegisterWithPassword({
      email: regEmail.trim(),
      verificationToken,
      password: regPassword,
      fullName: regFullName.trim(),
    })
    setLoading(false)

    if (!res.success) {
      setErrorMsg(res.message)
    } else {
      setSuccessMsg('Đăng ký tài khoản thành công!')
      if (onBackToHome) onBackToHome()
    }
  }

  if (isAuthenticated && user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid #e2e8f0', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Thông tin tài khoản</h2>
          <p style={{ color: '#475569', marginBottom: 20, fontSize: 14 }}>
            Họ và tên: <strong>{user.full_name}</strong><br />
            Email đăng nhập: <strong>{user.email || user.username}</strong><br />
            Vai trò: <strong>{user.role === 'MANAGER' ? 'Quản lý' : 'Khách hàng'}</strong>
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {onBackToHome && (
              <button
                type="button"
                className="btn-primary"
                onClick={onBackToHome}
              >
                Về trang chủ
              </button>
            )}
            <button
              type="button"
              className="btn-logout"
              onClick={logout}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="auth-modal" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
        {onBackToHome && (
          <button
            className="auth-close-btn"
            onClick={onBackToHome}
            aria-label="Về trang chủ"
            title="Về trang chủ"
          >
            ✕
          </button>
        )}

        <div className="auth-header">
          <div className="auth-brand-badge">
            EventBox
          </div>
          <h2 className="auth-title">
            {tab === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
          </h2>
          <p className="auth-subtitle">
            {tab === 'login'
              ? 'Sử dụng địa chỉ email của bạn để đăng nhập'
              : 'Xác thực qua email để bảo mật tài khoản'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setErrorMsg(''); }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setErrorMsg(''); setRegisterStep(1); }}
          >
            Đăng ký
          </button>
        </div>

        {tab === 'login' ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            {errorMsg && (
              <div className="auth-error-banner" role="alert">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="auth-success-banner" role="status">
                {successMsg}
              </div>
            )}

            <div className="auth-input-group">
              <label className="auth-label" htmlFor="page-login-email">Địa chỉ Email</label>
              <input
                id="page-login-email"
                className="auth-input"
                type="email"
                placeholder="name@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label" htmlFor="page-login-password">Mật khẩu</label>
              <input
                id="page-login-password"
                className="auth-input"
                type="password"
                placeholder="Nhập mật khẩu..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>

            <p className="auth-footer-prompt">
              Chưa có tài khoản?
              <button
                type="button"
                className="auth-footer-link"
                onClick={() => setTab('register')}
              >
                Đăng ký ngay
              </button>
            </p>
          </form>
        ) : (
          <div className="auth-form">
            <div className="otp-steps-indicator">
              <div className={`otp-step-item ${registerStep >= 1 ? 'active' : ''}`}>
                <span className="step-circle">1</span>
                <span>Thông tin</span>
              </div>
              <div className="step-line" />
              <div className={`otp-step-item ${registerStep >= 2 ? 'active' : ''}`}>
                <span className="step-circle">2</span>
                <span>Mã xác thực</span>
              </div>
              <div className="step-line" />
              <div className={`otp-step-item ${registerStep >= 3 ? 'active' : ''}`}>
                <span className="step-circle">3</span>
                <span>Mật khẩu</span>
              </div>
            </div>

            {errorMsg && (
              <div className="auth-error-banner" role="alert">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="auth-success-banner" role="status">
                {successMsg}
              </div>
            )}

            {registerStep === 1 && (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="page-reg-fullname">Họ và tên</label>
                  <input
                    id="page-reg-fullname"
                    className="auth-input"
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="page-reg-email">Địa chỉ Email</label>
                  <input
                    id="page-reg-email"
                    className="auth-input"
                    type="email"
                    placeholder="name@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Đang gửi...' : 'Gửi mã xác thực về Email'}
                </button>
              </form>
            )}

            {registerStep === 2 && (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, color: '#475569' }}>
                  Mã xác thực đã được gửi đến hộp thư <strong>{regEmail}</strong>. Vui lòng kiểm tra email của bạn.
                  {previewUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}>
                        Mở hòm thư xem trước tại đây ↗
                      </a>
                    </div>
                  )}
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="page-reg-otp">Mã xác thực OTP (6 chữ số)</label>
                  <input
                    id="page-reg-otp"
                    className="auth-input"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: 20, letterSpacing: 6, textAlign: 'center', fontWeight: 700 }}
                    required
                    autoFocus
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading || regOtp.length !== 6}>
                  {loading ? 'Đang xác thực...' : 'Xác nhận mã'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                  <button
                    type="button"
                    style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => { setRegisterStep(1); setErrorMsg(''); }}
                  >
                    Thay đổi email
                  </button>
                  <button
                    type="button"
                    style={{ color: '#e63946', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={handleSendOtp}
                    disabled={loading}
                  >
                    Gửi lại mã
                  </button>
                </div>
              </form>
            )}

            {registerStep === 3 && (
              <form onSubmit={handleCompleteRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, fontSize: 13, color: '#047857' }}>
                  Email <strong>{regEmail}</strong> đã được xác thực thành công. Vui lòng thiết lập mật khẩu bảo vệ tài khoản.
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="page-reg-pwd">Mật khẩu mới</label>
                  <input
                    id="page-reg-pwd"
                    className="auth-input"
                    type="password"
                    placeholder="Tối thiểu 6 ký tự..."
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="page-reg-confirm">Xác nhận mật khẩu</label>
                  <input
                    id="page-reg-confirm"
                    className="auth-input"
                    type="password"
                    placeholder="Nhập lại mật khẩu..."
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Đang hoàn tất...' : 'Hoàn tất và Đăng nhập'}
                </button>
              </form>
            )}

            <p className="auth-footer-prompt">
              Đã có tài khoản?
              <button
                type="button"
                className="auth-footer-link"
                onClick={() => setTab('login')}
              >
                Đăng nhập ngay
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
