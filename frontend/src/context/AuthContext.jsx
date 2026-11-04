import { useEffect, useState } from 'react'
import { AuthContext } from './AuthState'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const TOKEN_KEY = 'eventbox_token'
function storedToken() {
  const current = localStorage.getItem(TOKEN_KEY)
  if (current) return current
  try { return JSON.parse(localStorage.getItem('eventbox-session') || 'null')?.token || null } catch { return null }
}
function normalizeUser(user) {
  return { ...user, fullName: user.fullName ?? user.full_name, full_name: user.fullName ?? user.full_name }
}
export function AuthProvider({ children }) {
  const [token, setToken] = useState(storedToken)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('login')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!token) { setUser(null); setLoading(false); return }
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (controller.signal.aborted) return
          setUser(normalizeUser(data.user))
          localStorage.setItem(TOKEN_KEY, token)
          localStorage.removeItem('eventbox-session')
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('eventbox-session'); setToken(null); setUser(null)
        }
      } catch (error) { if (error.name !== 'AbortError') console.error('Không thể kiểm tra phiên đăng nhập.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [token])
  const authenticate = async (path, body, acceptSession = true) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) return { success: false, message: data.message || 'Không thể xử lý yêu cầu.' }
      if (acceptSession) {
        localStorage.setItem(TOKEN_KEY, data.token); localStorage.removeItem('eventbox-session')
        setUser(normalizeUser(data.user)); setToken(data.token); setModalOpen(false)
      }
      return { success: true, ...data }
    } catch { return { success: false, message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.' } }
  }
  const login = (email, password) => authenticate('login', { email, password })
  const register = ({ email, password, fullName }) => authenticate('register', { email, password, full_name: fullName }, false)
  const verifyRegistration = (email, code) => authenticate('verify-registration', { email, code })
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('eventbox-session')
    sessionStorage.removeItem('eventbox-active-reservation'); sessionStorage.removeItem('eventbox-reservation-request')
    setToken(null); setUser(null)
  }
  return <AuthContext.Provider value={{ user, token, loading, isAuthenticated: Boolean(user), modalOpen, modalTab,
    openAuthModal: (tab = 'login') => { setModalTab(tab); setModalOpen(true) }, closeAuthModal: () => setModalOpen(false),
    login, register, verifyRegistration, logout }}>{children}</AuthContext.Provider>
}
