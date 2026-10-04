import { useState, useEffect } from 'react'
import '../App.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

/* ── Mock event data (sẽ thay bằng API thật) ─────────── */
const CATEGORIES = [
  { id: 'all', label: 'Tất cả', icon: '🎯' },
  { id: 'music', label: 'Âm nhạc', icon: '🎵' },
  { id: 'sport', label: 'Thể thao', icon: '⚽' },
  { id: 'art', label: 'Nghệ thuật', icon: '🎨' },
  { id: 'tech', label: 'Công nghệ', icon: '💻' },
  { id: 'festival', label: 'Lễ hội', icon: '🎉' },
  { id: 'workshop', label: 'Workshop', icon: '📚' },
]

const FEATURED = [
  {
    id: 1, badge: 'HOT', badgeClass: 'badge-hot',
    emoji: '🎸',
    bg: 'linear-gradient(135deg,#1e1b4b,#312e81)',
    category: 'ÂM NHẠC',
    title: 'Rock Storm 2026 — Đêm nhạc Rock không ngủ',
    date: 'Thứ Bảy, 18/10/2026 · 19:30',
    location: 'Nhà thi đấu Phú Thọ, TP.HCM',
    price: '350.000',
    available: 'Còn vé',
  },
  {
    id: 2, badge: 'MỚI', badgeClass: 'badge-new',
    emoji: '💻',
    bg: 'linear-gradient(135deg,#0f4c81,#1a6ea8)',
    category: 'CÔNG NGHỆ',
    title: 'Vietnam Tech Summit 2026',
    date: 'Chủ nhật, 26/10/2026 · 08:00',
    location: 'GEM Center, Quận 1, TP.HCM',
    price: '500.000',
    available: 'Còn vé',
  },
  {
    id: 3, badge: 'SẮP DIỄN RA', badgeClass: 'badge-soon',
    emoji: '🎭',
    bg: 'linear-gradient(135deg,#7c2d12,#9a3412)',
    category: 'NGHỆ THUẬT',
    title: 'Kịch nói: Cuộc đời như một vở kịch',
    date: 'Thứ Sáu, 31/10/2026 · 20:00',
    location: 'Nhà hát Thành phố, Quận 1',
    price: '200.000',
    available: 'Ít vé',
  },
]

const EVENTS = [
  { id: 10, emoji: '🎤', bg: '#fef3c7', category: 'ÂM NHẠC', title: 'Đêm nhạc Trịnh Công Sơn', date: '05/10/2026', location: 'Hà Nội', price: '150.000' },
  { id: 11, emoji: '🏃', bg: '#d1fae5', category: 'THỂ THAO', title: 'TP.HCM Marathon 2026', date: '12/10/2026', location: 'TP.HCM', price: 'Miễn phí', isFree: true },
  { id: 12, emoji: '🎨', bg: '#ede9fe', category: 'NGHỆ THUẬT', title: 'Triển lãm Mỹ thuật Đương đại', date: '08/10/2026', location: 'Đà Nẵng', price: '80.000' },
  { id: 13, emoji: '📱', bg: '#dbeafe', category: 'CÔNG NGHỆ', title: 'AI & Future Conference', date: '15/10/2026', location: 'TP.HCM', price: '300.000', low: true },
  { id: 14, emoji: '🎉', bg: '#fce7f3', category: 'LỄ HỘI', title: 'Lễ hội Ánh sáng Hội An 2026', date: '20/10/2026', location: 'Hội An', price: '120.000' },
  { id: 15, emoji: '🌿', bg: '#ecfdf5', category: 'WORKSHOP', title: 'Workshop: Thiết kế bền vững', date: '22/10/2026', location: 'Hà Nội', price: '250.000' },
  { id: 16, emoji: '🎵', bg: '#fff7ed', category: 'ÂM NHẠC', title: 'Jazz Night by the River', date: '25/10/2026', location: 'TP.HCM', price: '180.000', low: true },
  { id: 17, emoji: '⚽', bg: '#fef9c3', category: 'THỂ THAO', title: 'Giải bóng đá Cúp Thanh Niên', date: '02/11/2026', location: 'Hà Nội', price: 'Miễn phí', isFree: true },
]

/* ── Icon component ──────────────────────────────────── */
function Icon({ name }) {
  const paths = {
    ticket: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M9 5v3m0 3v2m0 3v3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

/* ── Featured card ───────────────────────────────────── */
function FeaturedCard({ event }) {
  return (
    <div className="featured-card">
      <div className="fc-banner" style={{ background: event.bg }}>
        <div className="fc-banner-placeholder">{event.emoji}</div>
        <span className={`fc-badge ${event.badgeClass}`}>{event.badge}</span>
      </div>
      <div className="fc-body">
        <p className="fc-category">{event.category}</p>
        <h3 className="fc-title">{event.title}</h3>
        <div className="fc-meta">
          <div className="fc-meta-row"><Icon name="calendar" />{event.date}</div>
          <div className="fc-meta-row"><Icon name="mapPin" />{event.location}</div>
        </div>
      </div>
      <div className="fc-footer">
        <div className="fc-price">
          {event.price}<small> đ</small>
        </div>
        <button className="btn-ticket">Mua vé</button>
      </div>
    </div>
  )
}

/* ── Event card ──────────────────────────────────────── */
function EventCard({ event }) {
  return (
    <div className="event-card">
      <div className="ec-img" style={{ background: event.bg }}>
        <div className="ec-img-placeholder">{event.emoji}</div>
        <div className="ec-date-badge">{event.date}</div>
      </div>
      <div className="ec-body">
        <p className="ec-category">{event.category}</p>
        <h3 className="ec-title">{event.title}</h3>
        <div className="ec-location"><Icon name="mapPin" />{event.location}</div>
      </div>
      <div className="ec-footer">
        <div className={`ec-price${event.isFree ? ' free' : ''}`}>{event.price}</div>
        <span className={`ec-avail${event.low ? ' low' : ''}`}>{event.low ? '⚡ Ít vé' : '● Còn vé'}</span>
      </div>
    </div>
  )
}

/* ── Navbar ──────────────────────────────────────────── */
function Navbar() {
  return (
    <nav className="navbar" role="navigation" aria-label="Điều hướng chính">
      <a className="nav-brand" href="/" aria-label="EventBox trang chủ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
          <path d="M9 5v3m0 3v2m0 3v3" />
        </svg>
        EventBox
      </a>
      <div className="nav-links" role="list">
        {['Sự kiện', 'Âm nhạc', 'Thể thao', 'Lễ hội'].map((l) => (
          <a key={l} className="nav-link-item" href="#events" role="listitem">{l}</a>
        ))}
      </div>
      <div className="nav-right">
        <a className="btn-ghost" href="/my-tickets">Vé của tôi</a>
        <a className="btn-primary" href="/checkout">Xác nhận vé</a>
      </div>
    </nav>
  )
}

/* ── Main page ───────────────────────────────────────── */
export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [apiStatus, setApiStatus] = useState(null)

  /* Kiểm tra sức khỏe hệ thống ngầm — không hiển thị nổi bật */
  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    fetch(`${API_URL}/health`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setApiStatus(d?.status === 'healthy' ? 'up' : 'degraded'))
      .catch(() => setApiStatus('down'))
      .finally(() => clearTimeout(timer))
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [])

  const visibleEvents = EVENTS.filter((e) => {
    const matchCat = activeCategory === 'all' || CATEGORIES.find(
      (c) => c.id === activeCategory && e.category.toLowerCase().includes(c.label.toLowerCase().slice(0, 4))
    )
    const matchQ = !query || e.title.toLowerCase().includes(query.toLowerCase()) || e.location.toLowerCase().includes(query.toLowerCase())
    return matchCat && matchQ
  })

  return (
    <div className="app">
      <Navbar apiStatus={apiStatus} />

      {/* ── Hero ── */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <h1 id="hero-title">Khám phá sự kiện<br />dành cho <em>bạn.</em></h1>
          <p className="hero-sub">Hàng nghìn sự kiện âm nhạc, thể thao, nghệ thuật và công nghệ đang chờ bạn. Đặt vé dễ dàng, nhanh chóng và an toàn.</p>
          <div className="hero-actions">
            <a className="btn-hero btn-hero-primary" href="#events">
              <Icon name="ticket" /> Xem sự kiện
            </a>
            <a className="btn-hero btn-hero-outline" href="#featured">
              <Icon name="star" /> Nổi bật tuần này
            </a>
          </div>  
        </div>
      </section>

      {/* ── Tìm kiếm ── */}
      <div className="search-section">
        <div className="search-inner">
          <div className="search-bar" role="search">
            <span className="search-icon" aria-hidden="true"><Icon name="search" /></span>
            <input
              className="search-input"
              type="search"
              placeholder="Tìm sự kiện, nghệ sĩ, địa điểm…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm kiếm sự kiện"
            />
            <div className="search-divider" aria-hidden="true" />
            <select className="search-select" aria-label="Chọn thành phố">
              <option>TP.HCM</option>
              <option>Hà Nội</option>
              <option>Đà Nẵng</option>
              <option>Tất cả</option>
            </select>
            <button className="btn-search" aria-label="Tìm kiếm">Tìm kiếm</button>
          </div>
        </div>
      </div>

      {/* ── Categories ── */}
      <div className="category-section" aria-label="Lọc theo thể loại">
        <div className="category-inner">
          <p className="section-label">THỂ LOẠI</p>
          <div className="category-list" role="list">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="listitem"
                className={`chip${activeCategory === c.id ? ' active' : ''}`}
                onClick={() => setActiveCategory(c.id)}
                aria-pressed={activeCategory === c.id}
              >
                <span className="chip-icon" aria-hidden="true">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="main" id="events" tabIndex={-1}>

        {/* Featured */}
        {activeCategory === 'all' && !query && (
          <section aria-labelledby="featured-title" id="featured">
            <div className="section-header">
              <h2 className="section-title" id="featured-title">
                🔥 Sự kiện nổi bật <span>được chọn lọc</span>
              </h2>
              <a className="section-link" href="#events">Xem thêm <Icon name="chevronRight" /></a>
            </div>
            <div className="featured-strip">
              {FEATURED.map((e) => <FeaturedCard key={e.id} event={e} />)}
            </div>
          </section>
        )}

        {/* Promo banner */}
        {activeCategory === 'all' && !query && (
          <div className="promo-banner" role="complementary" aria-label="Khuyến mãi">
            <div className="promo-content">
              <h2>Tạo tài khoản — Đặt vé ngay</h2>
              <p>Nhận thông báo sự kiện mới nhất, ưu đãi độc quyền và quản lý vé của bạn dễ dàng hơn bao giờ hết.</p>
            </div>
            <button className="btn-promo">Đặt vé ngay →</button>
          </div>
        )}

        {/* Event grid */}
        <section aria-labelledby="all-events-title">
          <div className="section-header">
            <h2 className="section-title" id="all-events-title">
              {activeCategory === 'all' && !query ? 'Sắp diễn ra' : 'Kết quả tìm kiếm'}
              <span>
                {visibleEvents.length > 0 ? `${visibleEvents.length} sự kiện` : ''}
              </span>
            </h2>
          </div>

          {visibleEvents.length > 0 ? (
            <div className="event-grid" role="list" aria-label="Danh sách sự kiện">
              {visibleEvents.map((e) => (
                <div key={e.id} role="listitem">
                  <EventCard event={e} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" role="status">
              <div className="empty-state-icon">🔍</div>
              <h3>Không tìm thấy sự kiện</h3>
              <p>Hãy thử từ khóa khác hoặc chọn thể loại khác.</p>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="footer-brand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                  <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
                  <path d="M9 5v3m0 3v2m0 3v3" />
                </svg>
                EventBox
              </div>
              <p className="footer-desc">Web app đặt vé sự kiện trực tuyến — BTL môn Hệ quản trị Cơ sở dữ liệu HK261.</p>
            </div>
            <div className="footer-col">
              <h4>KHÁM PHÁ</h4>
              <ul>
                <li><a href="#">Âm nhạc</a></li>
                <li><a href="#">Thể thao</a></li>
                <li><a href="#">Nghệ thuật</a></li>
                <li><a href="#">Lễ hội</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>HỖ TRỢ</h4>
              <ul>
                <li><a href="#">Trung tâm trợ giúp</a></li>
                <li><a href="#">Liên hệ</a></li>
                <li><a href="#">Chính sách hoàn vé</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>NHÀ TỔ CHỨC</h4>
              <ul>
                <li><a href="#">Tạo sự kiện</a></li>
                <li><a href="#">Quản lý vé</a></li>
                <li><a href="#">Thống kê</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 EventBox · Đồ án DBMS · React + Node.js + MySQL + Redis</span>
            <div className="footer-badges">
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

