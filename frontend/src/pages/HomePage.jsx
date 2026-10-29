import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/useAuth'
import EventDetailModal from '../components/EventDetailModal'
import '../components/Auth.css'
import '../App.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'MUSIC', label: 'Âm nhạc' },
  { id: 'SPORTS', label: 'Thể thao' },
  { id: 'THEATER', label: 'Sân khấu & Nghệ thuật' },
  { id: 'WORKSHOP', label: 'Hội thảo' },
  { id: 'FESTIVAL', label: 'Lễ hội' },
]

function Icon({ name }) {
  const paths = {
    ticket: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M9 5v3m0 3v2m0 3v3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    chevronRight: <path d="m9 18 6-6-6-6" />,
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function EventCardItem({ event, onClick }) {
  const formatPrice = (p) => {
    if (p == null) return 'Đang cập nhật'
    return new Intl.NumberFormat('vi-VN').format(p) + ' đ'
  }

  const formatDate = (isoStr) => {
    if (!isoStr) return 'Sắp mở bán'
    const d = new Date(isoStr)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="event-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="ec-img" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
        <div className="ec-date-badge">{formatDate(event.earliest_showing_at)}</div>
      </div>
      <div className="ec-body">
        <p className="ec-category">{event.category}</p>
        <h3 className="ec-title">{event.title}</h3>
        <div className="ec-location">
          <Icon name="mapPin" />
          <span>{event.venue_name ? `${event.venue_name} (${event.city_code})` : (event.city_code || 'Toàn quốc')}</span>
        </div>
      </div>
      <div className="ec-footer">
        <div className="ec-price">
          {event.min_price != null ? `Từ ${formatPrice(event.min_price)}` : 'Đang cập nhật giá'}
        </div>
        <span className="ec-avail" style={{ color: '#059669', fontWeight: 600 }}>
          {event.sales_status === 'OPEN' ? 'Đang mở bán' : event.sales_status === 'UPCOMING' ? 'Sắp mở bán' : 'Đã ngừng bán'}
        </span>
      </div>
    </div>
  )
}

function Navbar({ onOpenAdminEvents }) {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth()

  return (
    <nav className="navbar" role="navigation" aria-label="Điều hướng chính">
      <a className="nav-brand" href="/" aria-label="EventBox trang chủ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
          <path d="M9 5v3m0 3v2m0 3v3" />
        </svg>
        EventBox
      </a>
      <div className="nav-links" role="list">
        {['Sự kiện', 'Âm nhạc', 'Thể thao', 'Sân khấu'].map((item) => (
          <a key={item} className="nav-link-item" href="#events" role="listitem">{item}</a>
        ))}
      </div>
      <div className="nav-right">
        {isAuthenticated && user?.role === 'MANAGER' && (
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenAdminEvents}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              padding: '7px 14px',
              fontSize: 13,
            }}
          >
            Quản lý sự kiện
          </button>
        )}

        {!isAuthenticated ? (
          <>
            <button className="btn-ghost" onClick={() => openAuthModal('login')}>
              Đăng nhập
            </button>
            <button className="btn-primary" onClick={() => openAuthModal('register')}>
              Đăng ký
            </button>
          </>
        ) : (
          <div className="nav-user-profile">
            {user?.role === 'USER' && <a className="btn-ghost" href="/my-tickets">Vé của tôi</a>}
            <div className="user-badge" title={user?.email || ''}>
              <div className="user-avatar">
                {user?.full_name ? user.full_name[0] : (user?.username ? user.username[0] : 'U')}
              </div>
              <div className="user-info">
                <span className="user-name">{user?.full_name || user?.username}</span>
                <span className={`user-role role-${(user?.role || 'user').toLowerCase()}`}>
                  {user?.role === 'MANAGER' ? 'Quản lý' : 'Khách hàng'}
                </span>
              </div>
            </div>
            <button className="btn-logout" onClick={logout} title="Đăng xuất">
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function HomePage({ onOpenAuthPage, onOpenAdminEvents }) {
  const { isAuthenticated, user } = useAuth()
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const activeRequest = useRef(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('ALL')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState(null)

  const fetchEvents = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.append('search', query.trim())
      if (activeCategory !== 'all') params.append('category', activeCategory)
      if (selectedCity !== 'ALL') params.append('city', selectedCity)

      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('page', page)
      const res = await fetch(`${API_URL}/api/events?${params.toString()}`, { signal: controller.signal })
      if (res.ok) {
        const data = await res.json()
        if (controller.signal.aborted) return
        setEvents(data.events || [])
        setTotal(data.total)
        setTotalPages(data.total_pages)
      } else {
        const data = await res.json()
        throw new Error(data.message || 'Không thể tải sự kiện.')
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Không thể kết nối đến máy chủ.')
    } finally {
      if (activeRequest.current === controller) setLoading(false)
    }
  }, [query, activeCategory, selectedCity, from, to, page])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents()
    }, 200)
    return () => { clearTimeout(timer); activeRequest.current?.abort() }
  }, [fetchEvents])

  return (
    <div className="app">
      <Navbar onOpenAdminEvents={onOpenAdminEvents} />

      {/* Hero Banner */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <h1 id="hero-title">Khám phá và đặt vé<br />các sự kiện hàng đầu</h1>
          <p className="hero-sub">Nền tảng đặt vé trực tuyến an toàn, nhanh chóng và bảo mật cho mọi sự kiện âm nhạc, thể thao và nghệ thuật.</p>
          <div className="hero-actions">
            <a className="btn-hero btn-hero-primary" href="#events">
              <Icon name="ticket" /> Khám phá sự kiện
            </a>
            {isAuthenticated && user?.role === 'MANAGER' && (
              <button
                type="button"
                className="btn-hero btn-hero-outline"
                onClick={onOpenAdminEvents}
              >
                Quản lý sự kiện
              </button>
            )}
          </div>  
        </div>
      </section>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-inner">
          <form className="search-bar" role="search" onSubmit={e => { e.preventDefault(); fetchEvents() }}>
            <label className="search-keyword">
              <span className="search-icon" aria-hidden="true"><Icon name="search" /></span>
              <input className="search-input" type="search" placeholder="Bạn muốn tham gia sự kiện nào?"
                value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} aria-label="Tìm kiếm sự kiện" />
            </label>
            <label className="search-field search-city">
              <span className="search-field-label"><Icon name="mapPin" />Địa điểm</span>
              <select className="search-select" value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setPage(1) }}>
                <option value="ALL">Tất cả thành phố</option>
                <option value="HCM">TP. Hồ Chí Minh</option>
                <option value="HN">Hà Nội</option>
                <option value="DN">Đà Nẵng</option>
              </select>
            </label>
            <div className="search-date-range" role="group" aria-label="Khoảng ngày tổ chức">
              <label className="search-field">
                <span className="search-field-label"><Icon name="calendar" />Từ ngày</span>
                <input className="search-date" type="date" value={from} max={to || undefined}
                  onChange={e => { setFrom(e.target.value); setPage(1) }} />
              </label>
              <span className="date-range-arrow" aria-hidden="true">→</span>
              <label className="search-field">
                <span className="search-field-label">Trước ngày</span>
                <input className="search-date" type="date" value={to} min={from || undefined}
                  onChange={e => { setTo(e.target.value); setPage(1) }} />
              </label>
            </div>
            <button type="submit" className="btn-search"><Icon name="search" />Tìm kiếm</button>
          </form>
          {(from || to) && <div className="search-filter-summary">
            <span>Lọc theo ngày tổ chức · Ngày kết thúc không bao gồm trong khoảng lọc</span>
            <button type="button" onClick={() => { setFrom(''); setTo(''); setPage(1) }}>Xóa ngày đã chọn ×</button>
          </div>}
        </div>
      </div>

      {/* Categories Bar */}
      <div className="category-section" aria-label="Lọc theo thể loại">
        <div className="category-inner">
          <div className="category-list" role="list">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="listitem"
                className={`chip${activeCategory === c.id ? ' active' : ''}`}
                onClick={() => { setActiveCategory(c.id); setPage(1) }}
                aria-pressed={activeCategory === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Events List */}
      <main className="main" id="events" tabIndex={-1}>
        <div className="section-header">
          <h2 className="section-title" id="all-events-title">
            {activeCategory === 'all' && !query ? 'Sự kiện sắp diễn ra' : 'Kết quả tìm kiếm'}
            <span>{events.length > 0 ? `(${total} sự kiện)` : ''}</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
            <div className="evt-spinner" style={{ margin: '0 auto 12px' }} />
            Đang tải danh sách sự kiện...
          </div>
        ) : error ? (
          <div role="alert"><p>{error}</p><button className="btn-primary" onClick={fetchEvents}>Thử lại</button></div>
        ) : events.length > 0 ? (
          <div className="event-grid" role="list" aria-label="Danh sách sự kiện">
            {events.map((evt) => (
              <div key={evt.id} role="listitem">
                <EventCardItem
                  event={evt}
                  onClick={() => setSelectedEventId(evt.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" role="status">
            <h3>Không tìm thấy sự kiện phù hợp</h3>
            <p>Vui lòng thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục khác.</p>
            {isAuthenticated && user?.role === 'MANAGER' && (
              <button
                className="btn-primary"
                onClick={onOpenAdminEvents}
                style={{ marginTop: 14 }}
              >
                Tạo sự kiện mới
              </button>
            )}
          </div>
        )}
        {!loading && !error && totalPages > 1 && <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span>Trang {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
        </div>}
      </main>

      {/* Event Details Modal */}
      {selectedEventId && (
        <EventDetailModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onSelectTicket={(evt, showing) => {
            window.location.assign(`/reserve?showing=${encodeURIComponent(showing.id)}`)
          }}
        />
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="footer-brand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
                  <path d="M9 5v3m0 3v2m0 3v3" />
                </svg>
                EventBox
              </div>
              <p className="footer-desc">Nền tảng thương mại điện tử chuyên biệt cho vé sự kiện và giải trí trực tuyến.</p>
            </div>
            <div className="footer-col">
              <h4>DANH MỤC</h4>
              <ul>
                <li><a href="#events" onClick={() => setActiveCategory('MUSIC')}>Âm nhạc</a></li>
                <li><a href="#events" onClick={() => setActiveCategory('SPORTS')}>Thể thao</a></li>
                <li><a href="#events" onClick={() => setActiveCategory('THEATER')}>Sân khấu & Nghệ thuật</a></li>
                <li><a href="#events" onClick={() => setActiveCategory('WORKSHOP')}>Hội thảo</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>TÀI KHOẢN</h4>
              <ul>
                <li><button type="button" onClick={onOpenAuthPage} style={{ color: '#9ca3af', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Tài khoản của tôi</button></li>
                {isAuthenticated && user?.role === 'MANAGER' && (
                  <li><button type="button" onClick={onOpenAdminEvents} style={{ color: '#9ca3af', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Quản trị sự kiện</button></li>
                )}
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 EventBox. Bản quyền thuộc về hệ thống đặt vé trực tuyến EventBox.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
