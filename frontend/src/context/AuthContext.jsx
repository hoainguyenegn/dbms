import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const TOKEN_KEY = 'eventbox_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('login') // 'login' | 'register'

  // Xác thực token và lấy thông tin phiên người dùng khi ứng dụng tải
  const fetchMe = useCallback(async (authToken) => {
    if (!authToken) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      }
    } catch (err) {
      console.error('Lỗi kết nối khi xác thực phiên làm việc:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchMe(token)
    } else {
      setLoading(false)
    }
  }, [token, fetchMe])

  // Hàm Đăng nhập (Email là tên đăng nhập duy nhất)
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Đăng nhập không thành công. Vui lòng thử lại.',
        }
      }

      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      setModalOpen(false)

      return {
        success: true,
        message: data.message || 'Đăng nhập thành công!',
        user: data.user,
      }
    } catch {
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend.',
      }
    }
  }

  // BƯỚC 1: Yêu cầu gửi mã OTP về Email
  const sendRegisterOtp = async (email, fullName) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, full_name: fullName }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Không thể gửi mã xác nhận OTP.',
        }
      }

      return {
        success: true,
        message: data.message,
        dev_otp: data.dev_otp,
      }
    } catch {
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend.',
      }
    }
  }

  // BƯỚC 2: Đối chiếu mã OTP nhận được
  const verifyRegisterOtp = async (email, otp) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Mã OTP không chính xác.',
        }
      }

      return {
        success: true,
        message: data.message,
        verificationToken: data.verification_token,
      }
    } catch {
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend.',
      }
    }
  }

  // BƯỚC 3: Thiết lập mật khẩu và hoàn tất tạo tài khoản
  const completeRegisterWithPassword = async ({ email, verificationToken, password, fullName }) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email,
          verification_token: verificationToken,
          password,
          full_name: fullName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Thiết lập mật khẩu thất bại.',
        }
      }

      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token)
        setToken(data.token)
        setUser(data.user)
        setModalOpen(false)
      }

      return {
        success: true,
        message: data.message || 'Đăng ký tài khoản thành công!',
        user: data.user,
      }
    } catch {
      return {
        success: false,
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend.',
      }
    }
  }

  // Đăng xuất
  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }).catch(() => {})
      }
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    }
  }

  const openAuthModal = (tab = 'login') => {
    setModalTab(tab)
    setModalOpen(true)
  }

  const closeAuthModal = () => {
    setModalOpen(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        modalOpen,
        modalTab,
        setModalTab,
        openAuthModal,
        closeAuthModal,
        login,
        sendRegisterOtp,
        verifyRegisterOtp,
        completeRegisterWithPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider')
  }
  return context
}
