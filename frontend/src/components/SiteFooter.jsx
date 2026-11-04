import { useAuth } from '../context/useAuth'
import './SiteFooter.css'

const categories = [
  { id: 'MUSIC', label: 'Âm nhạc' },
  { id: 'SPORTS', label: 'Thể thao' },
  { id: 'THEATER', label: 'Sân khấu & Nghệ thuật' },
  { id: 'WORKSHOP', label: 'Hội thảo' },
]

export default function SiteFooter() {
  const { user } = useAuth()
  return (
    <footer className="footer site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="site-footer-about">
            <a className="footer-brand" href="/" aria-label="EventBox trang chủ">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" />
                <path d="M9 5v3m0 3v2m0 3v3" />
              </svg>
              EventBox
            </a>
            <p className="footer-desc">Khám phá sự kiện, lựa chọn trải nghiệm và quản lý vé của bạn tại một nơi.</p>
          </div>
          <nav className="footer-col" aria-label="Thể loại sự kiện ở chân trang">
            <h4>DANH MỤC</h4>
            <ul>
              {categories.map(category => <li key={category.id}><a href={`/?category=${category.id}#events`}>{category.label}</a></li>)}
            </ul>
          </nav>
          <nav className="footer-col" aria-label="Tài khoản ở chân trang">
            <h4>TÀI KHOẢN</h4>
            <ul>
              <li><a href="/account">Tài khoản của tôi</a></li>
              {(!user || user.role === 'USER') && <li><a href="/my-tickets">Vé của tôi</a></li>}
              {user?.role === 'MANAGER' && <li><a href="/admin/events">Quản lý sự kiện</a></li>}
              <li><a href="/">Khám phá sự kiện</a></li>
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} EventBox. Bản quyền thuộc về hệ thống đặt vé trực tuyến EventBox.</span>
        </div>
      </div>
    </footer>
  )
}
