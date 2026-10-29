import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function AuthModal() {
  const {
    modalOpen,
    modalTab,
    setModalTab,
    closeAuthModal,
    login,
    sendRegisterOtp,
    verifyRegisterOtp,
    completeRegisterWithPassword,
  } = useAuth()

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // 3-step Register form
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalOpen) {
        closeAuthModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen, closeAuthModal])

  useEffect(() => {
    setErrorMsg('')
    setSuccessMsg('')
    setRegisterStep(1)
    setRegOtp('')
    setPreviewUrl('')
    setVerificationToken('')
    setRegPassword('')
    setRegConfirmPassword('')
  }, [modalTab, modalOpen])

  if (!modalOpen) return null

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu.')
      return
    }

    setLoading(true)
    const result = await login(loginEmail.trim(), loginPassword)
    setLoading(false)

    if (!result.success) {
      setErrorMsg(result.message)
    } else {
      setSuccessMsg('Đăng nhập thành công!')
    }
  }

  // Bước 1: Gửi OTP về email
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

  // Bước 2: Xác nhận OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!regOtp.trim()) {
      setErrorMsg('Vui lòng nhập mã xác thực OTP.')
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
      setErrorMsg('Mật khẩu phải có độ dài tối thiểu 6 ký tự.')
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
    }
  }

  return (
    <div className="auth-backdrop" onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="auth-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            closeAuthModal();
          }}
          aria-label="Đóng cửa sổ"
        >
          ✕
        </button>

        <div className="auth-header">
          <div className="auth-brand-badge">
            EventBox
          </div>
          <h2 className="auth-title">
            {modalTab === 'login' ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản'}
          </h2>
          <p className="auth-subtitle">
            {modalTab === 'login'
              ? 'Sử dụng địa chỉ email của bạn để đăng nhập'
              : 'Xác thực qua email để kích hoạt tài khoản của bạn'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${modalTab === 'login' ? 'active' : ''}`}
            onClick={() => setModalTab('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${modalTab === 'register' ? 'active' : ''}`}
            onClick={() => setModalTab('register')}
          >
            Đăng ký
          </button>
        </div>

        {modalTab === 'login' ? (
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
              <label className="auth-label" htmlFor="login-email">Địa chỉ Email</label>
              <input
                id="login-email"
                className="auth-input"
                type="email"
                placeholder="name@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label" htmlFor="login-password">Mật khẩu</label>
              <input
                id="login-password"
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
                onClick={() => setModalTab('register')}
              >
                Đăng ký ngay
              </button>
            </p>
          </form>
        ) : (
          <div className="auth-form">
            {/* Stepper */}
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

            {/* Bước 1: Nhập Email & Họ tên */}
            {registerStep === 1 && (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="reg-fullname">Họ và tên</label>
                  <input
                    id="reg-fullname"
                    className="auth-input"
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="reg-email">Địa chỉ Email</label>
                  <input
                    id="reg-email"
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

            {/* Bước 2: Nhập mã OTP */}
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
                  <label className="auth-label" htmlFor="reg-otp">Mã xác thực OTP (6 chữ số)</label>
                  <input
                    id="reg-otp"
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

            {/* Bước 3: Thiết lập mật khẩu */}
            {registerStep === 3 && (
              <form onSubmit={handleCompleteRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, fontSize: 13, color: '#047857' }}>
                  Email <strong>{regEmail}</strong> đã được xác thực thành công. Vui lòng thiết lập mật khẩu bảo vệ tài khoản.
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="reg-pwd">Mật khẩu mới</label>
                  <input
                    id="reg-pwd"
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
                  <label className="auth-label" htmlFor="reg-pwd-confirm">Xác nhận mật khẩu</label>
                  <input
                    id="reg-pwd-confirm"
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
                onClick={() => setModalTab('login')}
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
