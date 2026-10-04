import { useEffect, useState } from 'react'
import './BookingPage.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const reservationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const filters = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'UPCOMING', label: 'Sắp diễn ra' },
  { id: 'PAST', label: 'Đã qua' },
  { id: 'CANCELLED', label: 'Đã hủy' },
]

function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem('eventbox-session') || 'null')
    return session?.token && session?.user ? session : null
  } catch {
    return null
  }
}

async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const error = new Error(payload?.message || 'Không thể hoàn tất yêu cầu.')
    error.status = response.status
    error.code = payload?.error
    throw error
  }
  return payload
}

function formatDate(value, options = {}) {
  if (!value) return 'Chưa cập nhật'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(value))
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN').format(value || 0)} đ`
}

function LoginPanel({ onLogin, onRegister, onVerify, error, busy }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (mode === 'login') {
      await onLogin({ username, password })
      return
    }
    if (mode === 'register') {
      const request = await onRegister({ username, full_name: fullName, email, password })
      if (request) {
        setEmail(request.email)
        setMode('verify')
      }
      return
    }
    await onVerify({ email, code })
  }

  return (
    <section className="booking-login" aria-labelledby="login-title">
      <div className="login-mark" aria-hidden="true">EB</div>
      <p className="booking-eyebrow">TÀI KHOẢN EVENTBOX</p>
      <h2 id="login-title">{mode === 'verify' ? 'Xác minh email' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập để tiếp tục'}</h2>
      <p className="login-copy">
        {mode === 'verify'
          ? `Nhập mã 6 chữ số vừa gửi đến ${email}. Mã có hiệu lực trong 10 phút.`
          : mode === 'register'
            ? 'Tạo tài khoản để xác nhận phiếu giữ và quản lý vé của bạn.'
            : 'Dùng tài khoản EventBox để xác nhận phiếu giữ hoặc xem vé đã đặt.'}
      </p>
      <form className="login-form" onSubmit={submit}>
        {mode !== 'verify' && (
          <>
            {mode === 'register' && (
              <>
                <label htmlFor="booking-full-name">Họ và tên</label>
                <input autoComplete="name" id="booking-full-name" maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </>
            )}
            <label htmlFor="booking-username">Tên đăng nhập</label>
            <input autoComplete="username" id="booking-username" maxLength={50} value={username} onChange={(event) => setUsername(event.target.value)} required />
            {mode === 'register' && (
              <>
                <label htmlFor="booking-email">Email</label>
                <input autoComplete="email" id="booking-email" maxLength={254} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </>
            )}
            <label htmlFor="booking-password">Mật khẩu</label>
            <input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} id="booking-password" maxLength={72} minLength={mode === 'register' ? 8 : undefined} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </>
        )}
        {mode === 'verify' && (
          <>
            <label htmlFor="registration-code">Mã xác minh</label>
            <input autoComplete="one-time-code" id="registration-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
          </>
        )}
        {error && <p className="booking-alert" role="alert">{error}</p>}
        <button className="booking-button booking-button-primary login-submit" disabled={busy}>
          {busy ? 'Đang xử lý…' : mode === 'verify' ? 'Xác minh và tạo tài khoản' : mode === 'register' ? 'Gửi mã xác minh' : 'Đăng nhập'}
        </button>
      </form>
      <div className="auth-switch">
        {mode === 'verify' ? (
          <button onClick={() => setMode('register')}>Sửa thông tin đăng ký</button>
        ) : (
          <>
            <span>{mode === 'register' ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</span>
            <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Đăng nhập' : 'Tạo tài khoản ngay'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

function TicketList({ booking }) {
  return (
    <div className="ticket-list">
      {booking.tickets.map((ticket) => (
        <article className="ticket-row" key={ticket.code}>
          <div>
            <span className="ticket-type">{ticket.ticketType} · Vé {ticket.ordinal}</span>
            <code>{ticket.code}</code>
          </div>
          <span className={`ticket-validity ${ticket.valid ? 'is-valid' : 'is-invalid'}`}>
            {ticket.valid ? 'Còn hiệu lực' : 'Đã hủy'}
          </span>
        </article>
      ))}
    </div>
  )
}

function BookingHistory({ token }) {
  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [now, setNow] = useState(0)
  const [result, setResult] = useState({ items: [], total: 0 })
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')
  const [expandedCode, setExpandedCode] = useState('')
  const [details, setDetails] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/api/bookings/my?page=${page}&page_size=10`, {
      token,
      signal: controller.signal,
    })
      .then((data) => {
        setResult(data)
        setPhase('ready')
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return
        setError(requestError.message)
        setPhase('error')
      })
    return () => controller.abort()
  }, [page, retry, token])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    const initialTimer = setTimeout(() => setNow(Date.now()), 0)
    return () => {
      clearInterval(timer)
      clearTimeout(initialTimer)
    }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const visibleBookings = result.items.filter((booking) => {
    const start = new Date(booking.showing.startsAt).getTime()
    const isCancelled = booking.status === 'CANCELLED'
    const matchesFilter = filter === 'ALL'
      || (filter === 'CANCELLED' && isCancelled)
      || (filter === 'UPCOMING' && !isCancelled && start >= now)
      || (filter === 'PAST' && !isCancelled && start < now)
    const matchesQuery = !normalizedQuery
      || `${booking.bookingCode} ${booking.event.title}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesFilter && matchesQuery
  })

  async function toggleDetails(bookingCode) {
    if (expandedCode === bookingCode) {
      setExpandedCode('')
      setDetails(null)
      return
    }
    setExpandedCode(bookingCode)
    setDetails(null)
    setError('')
    try {
      const data = await apiRequest(`/api/bookings/${encodeURIComponent(bookingCode)}`, { token })
      setDetails(data.booking)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function confirmCancellation() {
    if (!cancelTarget) return
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest(`/api/bookings/${encodeURIComponent(cancelTarget.bookingCode)}/cancel`, {
        token,
        method: 'POST',
      })
      setResult((current) => ({
        ...current,
        items: current.items.map((booking) => (
          booking.bookingCode === data.booking.bookingCode
            ? { ...booking, status: data.booking.status, cancelledAt: data.booking.cancelledAt }
            : booking
        )),
      }))
      if (expandedCode === data.booking.bookingCode) setDetails(data.booking)
      setCancelTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="booking-toolbar">
        <div className="booking-tabs" role="tablist" aria-label="Lọc đơn vé">
          {filters.map((item) => (
            <button
              aria-selected={filter === item.id}
              className={filter === item.id ? 'booking-tab active' : 'booking-tab'}
              key={item.id}
              onClick={() => setFilter(item.id)}
              role="tab"
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="booking-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Tìm theo mã đơn hoặc tên sự kiện"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm đơn vé"
            type="search"
            value={query}
          />
        </label>
      </div>

      {error && <p className="booking-alert booking-alert-wide" role="alert">{error}</p>}
      {phase === 'loading' && <div className="booking-state">Đang tải danh sách vé…</div>}
      {phase === 'error' && (
        <div className="booking-state">
          <h2>Chưa tải được lịch sử vé</h2>
          <p>{error}</p>
          <button className="booking-button booking-button-outline" onClick={() => {
            setPhase('loading')
            setRetry((value) => value + 1)
          }}>Thử lại</button>
        </div>
      )}
      {phase === 'ready' && visibleBookings.length === 0 && (
        <div className="booking-state booking-empty">
          <span className="empty-ticket-mark" aria-hidden="true">▱</span>
          <h2>{query || filter !== 'ALL' ? 'Không tìm thấy đơn vé phù hợp' : 'Bạn chưa có vé nào'}</h2>
          <p>{query || filter !== 'ALL' ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Đơn vé đã xác nhận sẽ xuất hiện tại đây.'}</p>
          {!query && filter === 'ALL' && <a className="booking-button booking-button-primary" href="/">Khám phá sự kiện</a>}
        </div>
      )}

      {phase === 'ready' && visibleBookings.length > 0 && (
        <div className="booking-list">
          {visibleBookings.map((booking) => {
            const canCancel = booking.status === 'CONFIRMED'
              && new Date(booking.showing.startsAt).getTime() > now
            const isExpanded = expandedCode === booking.bookingCode
            return (
              <article className="order-entry" key={booking.bookingCode}>
                <div className="order-summary">
                  <div className="order-date">
                    <span className="order-date-day">{new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(new Date(booking.showing.startsAt))}</span>
                    <span>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(new Date(booking.showing.startsAt))}</span>
                  </div>
                  <div className="order-main">
                    <div className="order-heading-row">
                      <span className={`booking-status ${booking.status === 'CONFIRMED' ? 'confirmed' : 'cancelled'}`}>
                        {booking.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đã hủy'}
                      </span>
                      <span className="order-code">Mã đơn {booking.bookingCode}</span>
                    </div>
                    <h2>{booking.event.title}</h2>
                    <p>{formatDate(booking.showing.startsAt)} <span>·</span> {booking.showing.venue}, {booking.showing.city}</p>
                    <div className="order-meta">
                      <span>{booking.ticketCount} vé</span>
                      <span>{formatMoney(booking.totalAmountVnd)}</span>
                      <span>Đặt {formatDate(booking.bookedAt)}</span>
                    </div>
                  </div>
                  <button
                    aria-expanded={isExpanded}
                    className="order-details-button"
                    onClick={() => toggleDetails(booking.bookingCode)}
                  >
                    {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="order-details">
                    {!details && <p className="details-loading">Đang tải vé…</p>}
                    {details && (
                      <>
                        <div className="detail-head">
                          <div><span className="detail-label">Tổng thanh toán nội bộ</span><strong>{formatMoney(details.totalAmountVnd)}</strong></div>
                          {canCancel && (
                            <button className="cancel-link" onClick={() => setCancelTarget(booking)}>
                              Hủy đơn
                            </button>
                          )}
                        </div>
                        <div className="line-items">
                          {details.items.map((item) => (
                            <div className="line-item" key={item.ticketTypeId}>
                              <span>{item.ticketType} × {item.quantity}</span>
                              <span>{formatMoney(item.subtotalVnd)}</span>
                            </div>
                          ))}
                        </div>
                        <TicketList booking={details} />
                      </>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {result.total > 10 && (
        <div className="booking-pagination">
          <button className="booking-button booking-button-outline" disabled={page <= 1} onClick={() => {
            setPhase('loading')
            setPage((value) => value - 1)
          }}>Trước</button>
          <span>Trang {page} / {Math.ceil(result.total / 10)}</span>
          <button className="booking-button booking-button-outline" disabled={page >= Math.ceil(result.total / 10)} onClick={() => {
            setPhase('loading')
            setPage((value) => value + 1)
          }}>Tiếp</button>
        </div>
      )}

      {cancelTarget && (
        <div className="booking-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setCancelTarget(null)
        }}>
          <section aria-labelledby="cancel-title" aria-modal="true" className="booking-modal" role="dialog">
            <p className="booking-eyebrow">XÁC NHẬN THAO TÁC</p>
            <h2 id="cancel-title">Hủy toàn bộ đơn vé?</h2>
            <p>Đơn {cancelTarget.bookingCode} sẽ chuyển sang trạng thái đã hủy. Vé sẽ không còn hiệu lực.</p>
            <div className="modal-actions">
              <button className="booking-button booking-button-outline" disabled={busy} onClick={() => setCancelTarget(null)}>Giữ đơn</button>
              <button className="booking-button booking-button-danger" disabled={busy} onClick={confirmCancellation}>
                {busy ? 'Đang xử lý…' : 'Xác nhận hủy'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function BookingConfirmation({ token }) {
  const [reservationId, setReservationId] = useState('')
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBooking(null)
    if (!reservationPattern.test(reservationId.trim())) {
      setError('Mã phiếu cần có định dạng UUID hợp lệ.')
      return
    }
    setBusy(true)
    try {
      const data = await apiRequest('/api/bookings/confirm', {
        token,
        method: 'POST',
        body: JSON.stringify({ reservation_id: reservationId.trim() }),
      })
      setBooking(data.booking)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="confirmation-layout">
      <section className="confirmation-form-panel">
        <p className="booking-eyebrow">HOÀN TẤT ĐẶT VÉ</p>
        <h2>Xác nhận phiếu giữ</h2>
        <p className="confirmation-copy">Phiếu giữ sẽ được kiểm tra lại về thời hạn, lịch bán và quyền sở hữu trước khi tạo đơn.</p>
        <form onSubmit={submit}>
          <label htmlFor="reservation-id">Mã phiếu giữ vé</label>
          <input
            autoComplete="off"
            id="reservation-id"
            onChange={(event) => setReservationId(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            spellCheck="false"
            value={reservationId}
          />
          {error && <p className="booking-alert" role="alert">{error}</p>}
          <button className="booking-button booking-button-primary confirm-submit" disabled={busy}>
            {busy ? 'Đang xác nhận…' : 'Xác nhận đặt vé'}
          </button>
        </form>
        <p className="confirmation-footnote">Không có giao dịch ngân hàng trong bước này. Đơn và vé được ghi nhận bằng transaction nội bộ của hệ thống.</p>
      </section>

      <aside className="confirmation-aside">
        <span className="aside-index">01 / 02</span>
        <h3>Giao dịch được ghi nhận trọn vẹn</h3>
        <p>Đơn hàng, chi tiết vé, mã vé điện tử và trạng thái phiếu giữ cùng commit hoặc cùng rollback.</p>
        <div className="transaction-steps">
          <span><i>1</i> Kiểm tra phiếu giữ</span>
          <span><i>2</i> Ghi đơn và phát hành vé</span>
          <span><i>3</i> Commit transaction</span>
        </div>
      </aside>

      {booking && (
        <section className="confirmation-success" aria-live="polite">
          <div className="success-heading">
            <span className="success-check" aria-hidden="true">✓</span>
            <div>
              <p className="booking-eyebrow">ĐẶT VÉ THÀNH CÔNG</p>
              <h2>{booking.event.title}</h2>
            </div>
          </div>
          <div className="success-meta">
            <span>Mã đơn <strong>{booking.bookingCode}</strong></span>
            <span>{booking.ticketCount} vé <strong>{formatMoney(booking.totalAmountVnd)}</strong></span>
            <span>{formatDate(booking.showing.startsAt)} · {booking.showing.venue}</span>
          </div>
          <TicketList booking={booking} />
          <a className="booking-button booking-button-outline" href="/my-tickets">Mở lịch sử vé</a>
        </section>
      )}
    </div>
  )
}

export default function BookingPage() {
  const isCheckout = window.location.pathname === '/checkout'
  const [session, setSession] = useState(readSession)
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)

  async function login(credentials) {
    setLoginBusy(true)
    setLoginError('')
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
      if (data.user.role !== 'USER') throw new Error('Tài khoản quản lý không thể sử dụng chức năng đặt vé cá nhân.')
      const nextSession = { token: data.token, user: data.user }
      localStorage.setItem('eventbox-session', JSON.stringify(nextSession))
      setSession(nextSession)
      return true
    } catch (error) {
      setLoginError(error.message)
      return false
    } finally {
      setLoginBusy(false)
    }
  }

  async function register(registration) {
    setLoginBusy(true)
    setLoginError('')
    try {
      return await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registration),
      })
    } catch (error) {
      setLoginError(error.message)
      return null
    } finally {
      setLoginBusy(false)
    }
  }

  async function verifyRegistration(verification) {
    setLoginBusy(true)
    setLoginError('')
    try {
      const data = await apiRequest('/api/auth/verify-registration', {
        method: 'POST',
        body: JSON.stringify(verification),
      })
      const nextSession = { token: data.token, user: data.user }
      localStorage.setItem('eventbox-session', JSON.stringify(nextSession))
      setSession(nextSession)
      return true
    } catch (error) {
      setLoginError(error.message)
      return false
    } finally {
      setLoginBusy(false)
    }
  }

  function logout() {
    localStorage.removeItem('eventbox-session')
    setSession(null)
  }

  return (
    <div className="booking-app">
      <header className="booking-header">
        <a aria-label="EventBox trang chủ" className="booking-brand" href="/">
          <span className="brand-ticket" aria-hidden="true">E</span>
          EventBox
        </a>
        <nav aria-label="Điều hướng tài khoản" className="booking-nav">
          <a href="/">Khám phá</a>
          <a aria-current={!isCheckout ? 'page' : undefined} href="/my-tickets">Vé của tôi</a>
          {session && <span className="booking-user">{session.user.fullName || session.user.username}</span>}
          {session
            ? <button onClick={logout}>Đăng xuất</button>
            : <a href="#sign-in">Đăng nhập</a>}
        </nav>
      </header>

      <main className="booking-main">
        <div className="booking-breadcrumb"><a href="/">Trang chủ</a><span>/</span><span>{isCheckout ? 'Xác nhận đặt vé' : 'Vé của tôi'}</span></div>
        <section className="booking-title-row">
          <div>
            <p className="booking-eyebrow">EVENTBOX / TÀI KHOẢN</p>
            <h1>{isCheckout ? 'Xác nhận đặt vé' : 'Vé của tôi'}</h1>
            <p>{isCheckout ? 'Hoàn tất đơn vé từ phiếu giữ còn hiệu lực.' : 'Theo dõi đơn hàng và mã vé điện tử của bạn.'}</p>
          </div>
          {session && <a className="booking-button booking-button-primary title-action" href={isCheckout ? '/my-tickets' : '/checkout'}>{isCheckout ? 'Lịch sử vé' : 'Xác nhận phiếu giữ'}</a>}
        </section>

        {!session && (
          <div id="sign-in">
            <LoginPanel error={loginError} busy={loginBusy} onLogin={login} onRegister={register} onVerify={verifyRegistration} />
          </div>
        )}
        {session && isCheckout && <BookingConfirmation key={session.user.id} token={session.token} />}
        {session && !isCheckout && <BookingHistory key={session.user.id} token={session.token} />}
      </main>

      <footer className="booking-footer"><span>EventBox</span><span>Đơn vé được quản lý an toàn trong tài khoản của bạn.</span></footer>
    </div>
  )
}