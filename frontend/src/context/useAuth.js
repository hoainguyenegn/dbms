import { useContext } from 'react'
import { AuthContext } from './AuthState'
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth cần nằm trong AuthProvider')
  return context
}
