import { useEffect } from 'react'
import { useAuth } from '../context/useAuth'
import AuthForm from './AuthForm'
import './Auth.css'
export default function AuthModal() {
  const { modalOpen, modalTab, closeAuthModal } = useAuth()
  useEffect(() => {
    if (!modalOpen) return
    const onKey = event => { if (event.key === 'Escape') closeAuthModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen, closeAuthModal])
  if (!modalOpen) return null
  return <div className="auth-backdrop" onClick={closeAuthModal}>
    <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Tài khoản EventBox" onClick={e => e.stopPropagation()}>
      <button type="button" className="auth-close-btn" onClick={closeAuthModal} aria-label="Đóng">×</button>
      <AuthForm key={modalTab} initialTab={modalTab} />
    </div>
  </div>
}
