import { useEffect, useRef, useState } from 'react'
import './BookingPage.css'
import { useAuth } from '../context/useAuth'
import AuthForm from '../components/AuthForm'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const reservationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const filters = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'UPCOMING', label: 'Sắp diễn ra' },
  { id: 'PAST', label: 'Đã qua' },
  { id: 'CANCELLED', label: 'Đã hủy' },
]

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
  const [detailsError, setDetailsError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const detailsRequest = useRef(null)

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

  useEffect(() => () => detailsRequest.current?.abort(), [])

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

  async function toggleDetails(bookingCode, force = false) {
    detailsRequest.current?.abort()
    if (expandedCode === bookingCode && !force) {
      setExpandedCode('')
      setDetails(null)
      return
    }
    const controller = new AbortController()
    detailsRequest.current = controller
    setExpandedCode(bookingCode)
    setDetails(null)
    setDetailsError('')
    try {
      const data = await apiRequest(`/api/bookings/${encodeURIComponent(bookingCode)}`, { token, signal: controller.signal })
      if (!controller.signal.aborted) setDetails(data.booking)
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setDetailsError(requestError.message)
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
        <div className="booking-tabs" role="group" aria-label="Lọc vé">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item.id}
              className={filter === item.id ? 'booking-tab active' : 'booking-tab'}
              key={item.id}
              onClick={() => setFilter(item.id)}
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
            placeholder="Tìm vé của bạn"
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

                    </div>
                  </div>
                  <button
                    aria-expanded={isExpanded}
                    className="order-details-button"
                    onClick={() => toggleDetails(booking.bookingCode)}
                  >
                    {isExpanded ? 'Thu gọn' : 'Xem vé'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="order-details">
                    {!details && !detailsError && <p className="details-loading">Đang tải vé…</p>}
                    {detailsError && <div className="booking-detail-error"><p role="alert">{detailsError}</p><button className="booking-button booking-button-outline" onClick={() => toggleDetails(booking.bookingCode, true)}>Thử lại</button></div>}
                    {details && (
                      <>
                        <div className="detail-head">
                          <div><span className="detail-label">Tổng tiền</span><strong>{formatMoney(details.totalAmountVnd)}</strong></div>
                          {canCancel && (
                            <button className="cancel-link" onClick={() => { setError(''); setCancelTarget(booking) }}>
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
                        <h2 id="cancel-title">Bạn muốn hủy vé?</h2>
            <p>Toàn bộ vé cho {cancelTarget.event.title} trong đơn này sẽ không còn hiệu lực.</p>
            {error && <p className="booking-alert" role="alert">{error}</p>}
            <div className="booking-modal-actions">
              <button className="booking-button booking-button-outline" disabled={busy} onClick={() => setCancelTarget(null)}>Giữ lại vé</button>
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
  const [reservationId] = useState(() => (new URLSearchParams(window.location.search).get('reservation') || '').trim())
  const hasReservation = reservationPattern.test(reservationId)
  const [reservation, setReservation] = useState(null)
  const [phase, setPhase] = useState(hasReservation ? 'loading' : 'missing')
  const [retry, setRetry] = useState(0)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!hasReservation) return
    const controller = new AbortController()
    apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}`, { token, signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return
        setReservation(data.reservation)
        setPhase('ready')
        setError('')
      })
      .catch(requestError => {
        if (requestError.name === 'AbortError') return
        setError(requestError.message)
        setPhase('error')
      })
    return () => controller.abort()
  }, [hasReservation, reservationId, retry, token])

  useEffect(() => {
    if (!reservation || booking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [reservation, booking])

  const expiresAt = new Date(reservation?.expiresAt).getTime()
  const secondsLeft = Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const isActive = reservation?.status === 'ACTIVE' && secondsLeft > 0
  const alreadyConfirmed = reservation?.status === 'CONSUMED'

  function reload() {
    setPhase('loading')
    setError('')
    setRetry(value => value + 1)
  }

  async function submit(event) {
    event.preventDefault()
    if (busy || !reservation) return
    if (!alreadyConfirmed && (reservation.status !== 'ACTIVE' || expiresAt <= Date.now())) {
      setError('Thời gian giữ vé đã hết. Vui lòng chọn vé lại.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest('/api/bookings/confirm', {
        token,
        method: 'POST',
        body: JSON.stringify({ reservation_id: reservationId }),
      })
      setBooking(data.booking)
      sessionStorage.removeItem('eventbox-active-reservation')
    } catch (requestError) {
      setError(requestError.message)
      if (['RESERVATION_EXPIRED', 'RESERVATION_NOT_ACTIVE', 'SHOWING_NOT_ON_SALE', 'EVENT_NOT_ON_SALE'].includes(requestError.code)) {
        setReservation(current => ({ ...current, status: 'EXPIRED' }))
      }
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'missing') return <section className="booking-state booking-empty">
    <h2>Bạn chưa chọn vé</h2><p>Chọn sự kiện và số lượng vé trước khi xác nhận.</p>
    <a className="booking-button booking-button-primary" href="/reserve">Chọn vé</a>
  </section>
  if (phase === 'loading') return <div className="booking-state" role="status">Đang tải thông tin vé…</div>
  if (phase === 'error') return <section className="booking-state">
    <h2>Chưa tải được thông tin vé</h2><p role="alert">{error}</p>
    <div className="booking-state-actions"><button className="booking-button booking-button-outline" onClick={reload}>Thử lại</button><a className="booking-button booking-button-primary" href="/reserve">Chọn vé lại</a></div>
  </section>

  if (booking) return <section className="confirmation-success" aria-live="polite">
    <div className="success-heading"><span className="success-check" aria-hidden="true">✓</span><div><h2>{booking.status === 'CANCELLED' ? 'Đơn vé đã hủy' : 'Đặt vé thành công'}</h2><p>{booking.event.title}</p></div></div>
    <div className="success-meta"><span>{formatDate(booking.showing.startsAt)}</span><span>{booking.showing.venue}</span><span>{booking.ticketCount} vé · {formatMoney(booking.totalAmountVnd)}</span></div>
    <TicketList booking={booking} />
    <a className="booking-button booking-button-primary" href="/my-tickets">Xem vé của tôi</a>
  </section>

  return <form className="checkout-card" onSubmit={submit}>
    <div className="checkout-event"><span className="checkout-kicker">THÔNG TIN SỰ KIỆN</span><h2>{reservation.event?.title || 'Vé sự kiện'}</h2><p>{formatDate(reservation.showing?.startsAt)}</p><p>{reservation.showing?.venue}{reservation.showing?.city ? ` · ${reservation.showing.city}` : ''}</p></div>
    <div className="checkout-items" aria-label="Vé đã chọn">
      {reservation.items.map(item => <div className="checkout-line" key={item.ticketTypeId}><div><strong>{item.ticketType}</strong><span>{item.quantity} vé × {formatMoney(item.unitPriceVnd)}</span></div><strong>{formatMoney(item.subtotalVnd)}</strong></div>)}
    </div>
    <div className="checkout-total"><span>Tổng cộng</span><strong>{formatMoney(reservation.totalAmountVnd)}</strong></div>
    {isActive ? <div className="checkout-hold"><span>Vé đang được giữ cho bạn</span><strong role="timer" aria-label="Thời gian giữ vé còn lại">{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</strong></div> : alreadyConfirmed ? <p className="checkout-notice">Vé đã được xác nhận. Bạn có thể xem lại đơn vé.</p> : <p className="booking-alert" role="status">Vé không còn được giữ. Vui lòng chọn lại để tiếp tục.</p>}
    {error && <p className="booking-alert" role="alert">{error}</p>}
    <div className="checkout-actions">
      {isActive || alreadyConfirmed ? <><button type="submit" className="booking-button booking-button-primary" disabled={busy}>{busy ? 'Đang xác nhận…' : alreadyConfirmed ? 'Xem đơn vé' : 'Xác nhận đặt vé'}</button><a className="checkout-back" href="/reserve">Quay lại chọn vé</a></> : <a className="booking-button booking-button-primary" href="/reserve">Chọn vé lại</a>}
    </div>
  </form>
}

export default function BookingPage() {
  const isCheckout = window.location.pathname.replace(/\/+$/, '') === '/checkout'
  const { user, token, loading } = useAuth()
  const session = user && token ? { user, token } : null
  if (loading) return <main className="booking-main">Đang kiểm tra phiên đăng nhập...</main>
  if (user && user.role !== 'USER') return <main className="booking-main"><h1>Chức năng dành cho khách hàng</h1><a href="/admin/events">Về trang quản lý sự kiện</a></main>

  return (
    <div className="booking-app">
      <main className="booking-main">
        <div className="booking-breadcrumb"><a href="/">Trang chủ</a><span>/</span><span>{isCheckout ? 'Xác nhận đặt vé' : 'Vé của tôi'}</span></div>
        <section className="booking-title-row">
          <div>
            <h1>{isCheckout ? 'Kiểm tra đơn vé' : 'Vé của tôi'}</h1>
            <p>{isCheckout ? 'Kiểm tra thông tin bên dưới trước khi xác nhận.' : 'Xem vé và quản lý các đơn đã đặt.'}</p>
          </div>
          {session && <a className="booking-button booking-button-primary title-action" href={isCheckout ? '/my-tickets' : '/'}>{isCheckout ? 'Lịch sử vé' : 'Khám phá sự kiện'}</a>}
        </section>

        {!session && (
          <div id="sign-in" className="auth-page auth-page-inline">
            <section className="auth-card" aria-label="Đăng nhập để xem vé"><AuthForm /></section>
          </div>
        )}
        {session && isCheckout && <BookingConfirmation key={session.user.id} token={session.token} />}
        {session && !isCheckout && <BookingHistory key={session.user.id} token={session.token} />}
      </main>

    </div>
  )
}
