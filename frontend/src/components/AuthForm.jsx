import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import './Auth.css'

export default function AuthForm({ initialTab = 'login', onSuccess }) {
  const { login, register, verifyRegistration } = useAuth()
  const [tab, setTab] = useState(initialTab)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(e) {
    e.preventDefault(); setError(''); setMessage('')
    if (tab === 'register' && !pending && password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }
    setBusy(true)
    const result = tab === 'login' ? await login(email, password) : pending ? await verifyRegistration(email, code) : await register({ email, password, fullName })
    setBusy(false)
    if (!result.success) { setError(result.message); return }
    if (tab === 'register' && !pending) {
      setPending(true); setPassword(''); setConfirmPassword(''); setMessage('Mã xác minh đã gửi về email, có hiệu lực trong 10 phút.')
    } else onSuccess?.()
  }
  const switchTab = value => { setTab(value); setPending(false); setCode(''); setPassword(''); setConfirmPassword(''); setError(''); setMessage('') }
  return <>
    <div className="auth-header"><div className="auth-brand-badge">EventBox</div>
      <h2 className="auth-title">{pending ? 'Xác minh email' : tab === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h2>
      <p className="auth-subtitle">{pending ? `Nhập mã 6 chữ số đã gửi đến ${email}` : 'Một tài khoản để khám phá và quản lý vé của bạn'}</p>
    </div>
    <div className="auth-tabs">
      <button type="button" disabled={busy} className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Đăng nhập</button>
      <button type="button" disabled={busy} className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Đăng ký</button>
    </div>
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="auth-error-banner" role="alert">{error}</div>}
      {message && <div className="auth-success-banner" role="status">{message}</div>}
      {pending ? <div className="auth-input-group"><label className="auth-label" htmlFor="auth-code">Mã xác minh</label>
        <input id="auth-code" className="auth-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
      </div> : <>
        {tab === 'register' && <div className="auth-input-group"><label className="auth-label" htmlFor="auth-name">Họ và tên</label><input id="auth-name" className="auth-input" autoComplete="name" maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} required /></div>}
        <div className="auth-input-group"><label className="auth-label" htmlFor="auth-email">Email</label><input id="auth-email" className="auth-input" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div className="auth-input-group"><label className="auth-label" htmlFor="auth-password">Mật khẩu</label><input id="auth-password" className="auth-input" type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} minLength={tab === 'register' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {tab === 'register' && <div className="auth-input-group"><label className="auth-label" htmlFor="auth-confirm">Xác nhận mật khẩu</label><input id="auth-confirm" className="auth-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></div>}
      </>}
      <button type="submit" className="auth-submit-btn" disabled={busy}>{busy ? 'Đang xử lý...' : pending ? 'Xác minh và tạo tài khoản' : tab === 'login' ? 'Đăng nhập' : 'Gửi mã xác minh'}</button>
      {pending && <button type="button" disabled={busy} className="auth-footer-link" onClick={() => { setPending(false); setError(''); setMessage(''); setCode('') }}>Sửa thông tin / Gửi lại mã</button>}
    </form>
  </>
}
