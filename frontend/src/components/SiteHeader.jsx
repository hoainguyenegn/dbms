import { useAuth } from '../context/useAuth'
import './SiteHeader.css'

export default function SiteHeader({ currentPath = '/' }) {
  const { user, loading, openAuthModal, logout } = useAuth()
  const pathname = currentPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  const displayName = user?.fullName || user?.full_name || user?.username || 'Tài khoản'

  // Cấu hình danh sách Menu điều hướng
  const links = [
    { href: '/', label: 'Khám phá', active: ['/', '/reserve', '/checkout'].includes(pathname) },
    ...(!user || user.role === 'USER' ? [{ href: '/my-tickets', label: 'Vé của tôi', active: pathname === '/my-tickets' }] : []),
    ...(user?.role === 'MANAGER' ? [
      { href: '/admin/events', label: 'Quản lý sự kiện', active: pathname === '/admin/events' },
      { href: '/admin/stats', label: ' Bảng thống kê ', active: pathname === '/admin/stats' }, // Nút Thống kê F07
    ] : []),
  ]

  async function handleLogout() {
    await logout()
    window.location.assign('/')
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-brand" href="/" aria-label="EventBox trang chủ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M9 5v3m0 3v2m0 3v3" />
          </svg>
          <span>EventBox</span>
        </a>

        <nav className="site-primary-nav" aria-label="Điều hướng chính">
          {links.map(link => (
            <a
              key={link.href}
              className={`site-nav-link${link.active ? ' is-active' : ''}`}
              href={link.href}
              aria-current={link.active ? (pathname === link.href ? 'page' : 'location') : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-account-actions">
          {loading ? (
            <div className="site-session-loading" role="status" aria-label="Đang kiểm tra phiên đăng nhập">
              <span className="site-loading-avatar" aria-hidden="true" />
              <span className="site-loading-name" aria-hidden="true" />
            </div>
          ) : user ? (
            <>
              <a
                className={`site-account-link${pathname === '/account' ? ' is-active' : ''}`}
                href="/account"
                aria-label={`Tài khoản của ${displayName}`}
                aria-current={pathname === '/account' ? 'page' : undefined}
                title={displayName}
              >
                <span className="site-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
                <span className="site-account-name">{displayName}</span>
              </a>
              <button type="button" className="site-logout-button" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <button type="button" className="site-auth-button site-login-button" onClick={() => openAuthModal('login')}>
                Đăng nhập
              </button>
              <button type="button" className="site-auth-button site-register-button" onClick={() => openAuthModal('register')}>
                Đăng ký
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}