import { useEffect, useState } from 'react'
import './ReservationPage.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const SESSION_KEY = 'eventbox-session'
const ACTIVE_RESERVATION_KEY = 'eventbox-active-reservation'

function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return session?.token && session?.user?.role === 'USER' ? session : null
  } catch {
    return null
  }
}

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.message || 'Không thể xử lý yêu cầu giữ vé.')
  return data
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN').format(value || 0)} đ`
}

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value))
}

function readStoredReservation() {
  try {
    return sessionStorage.getItem(ACTIVE_RESERVATION_KEY) || ''
  } catch {
    return ''
  }
}

export default function ReservationPage() {
  const [session] = useState(readSession)
  const [showings, setShowings] = useState([])
  const [showingId, setShowingId] = useState('')
  const [quantities, setQuantities] = useState({})
  const [reservation, setReservation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showingsError, setShowingsError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    request('/api/showings/on-sale', { signal: controller.signal })
      .then((data) => {
        setShowings(data.items)
        setShowingId((current) => current || String(data.items[0]?.id || ''))
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setShowingsError(true)
          setError('Chưa tải được suất diễn. Kiểm tra backend và kết nối MySQL, rồi thử lại.')
        }
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!session) return undefined
    const reservationId = readStoredReservation()
    if (!reservationId) return undefined
    const controller = new AbortController()
    request(`/api/reservations/${encodeURIComponent(reservationId)}`, {
      token: session.token,
      signal: controller.signal,
    })
      .then((data) => {
        if (data.reservation.status === 'ACTIVE') setReservation(data.reservation)
        else sessionStorage.removeItem(ACTIVE_RESERVATION_KEY)
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return
        sessionStorage.removeItem(ACTIVE_RESERVATION_KEY)
      })
    return () => controller.abort()
  }, [session])

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  const selectedShowing = showings.find((item) => String(item.id) === showingId)
  const selectedItems = selectedShowing?.ticketTypes
    .filter((ticket) => Number(quantities[ticket.id]) > 0)
    .map((ticket) => ({ ticket_type_id: ticket.id, quantity: Number(quantities[ticket.id]) })) || []
  const totalQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0)
  const totalAmount = selectedItems.reduce((total, item) => {
    const ticket = selectedShowing.ticketTypes.find((entry) => entry.id === item.ticket_type_id)
    return total + item.quantity * ticket.priceVnd
  }, 0)
  const secondsLeft = reservation
    ? Math.max(0, Math.ceil((new Date(reservation.expiresAt).getTime() - now) / 1000))
    : 0
  const activeHold = reservation?.status === 'ACTIVE' && secondsLeft > 0

  function changeQuantity(ticket, delta) {
    setError('')
    const current = Number(quantities[ticket.id] || 0)
    const next = Math.max(0, Math.min(ticket.available, current + delta, current + delta <= 6 ? 6 : current))
    const nextTotal = totalQuantity - current + next
    if (nextTotal > 6) return
    setQuantities((currentQuantities) => ({ ...currentQuantities, [ticket.id]: next }))
  }

  function changeShowing(value) {
    setShowingId(value)
    setQuantities({})
    setError('')
  }

  async function placeHold() {
    if (!session) {
      setError('Đăng nhập bằng tài khoản khách hàng để giữ vé. Đăng nhập hoặc tạo tài khoản tại mục Vé của tôi.')
      return
    }
    if (!selectedShowing || totalQuantity < 1 || totalQuantity > 6) {
      setError('Chọn từ 1 đến 6 vé trước khi giữ.')
      return
    }
    setBusy(true)
    setError('')
    const payloadFingerprint = `${selectedShowing.id}:${JSON.stringify(selectedItems)}`
    try {
      const saved = JSON.parse(sessionStorage.getItem('eventbox-reservation-request') || 'null')
      const requestKey = saved?.fingerprint === payloadFingerprint ? saved.requestKey : crypto.randomUUID()
      sessionStorage.setItem('eventbox-reservation-request', JSON.stringify({ fingerprint: payloadFingerprint, requestKey }))
      const data = await request('/api/reservations', {
        token: session.token,
        method: 'POST',
        body: JSON.stringify({
          request_key: requestKey,
          showing_id: selectedShowing.id,
          items: selectedItems,
        }),
      })
      setReservation(data.reservation)
      sessionStorage.setItem(ACTIVE_RESERVATION_KEY, data.reservation.id)
      sessionStorage.removeItem('eventbox-reservation-request')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function releaseHold() {
    if (!reservation || !session) return
    setBusy(true)
    setError('')
    try {
      const data = await request(`/api/reservations/${encodeURIComponent(reservation.id)}/release`, {
        token: session.token,
        method: 'POST',
      })
      setReservation(data.reservation)
      sessionStorage.removeItem(ACTIVE_RESERVATION_KEY)
      setQuantities({})
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="reservation-app">
      <header className="reservation-header">
        <a className="reservation-brand" href="/">EventBox</a>
        <nav aria-label="Điều hướng người dùng">
          <a href="/">Sự kiện</a>
          <a href="/my-tickets">Vé của tôi</a>
          {!session && <a className="reservation-login" href="/my-tickets">Đăng nhập</a>}
        </nav>
      </header>

      <main className="reservation-main">
        <p className="reservation-breadcrumb"><a href="/">Sự kiện</a><span>/</span>Chọn vé</p>
        <div className="reservation-heading">
          <div>
            <p className="reservation-eyebrow">EVENTBOX / GIỮ VÉ</p>
            <h1>Chọn vé sự kiện</h1>
            <p>Chọn suất diễn và số lượng. Phiếu giữ có hiệu lực tối đa 5 phút.</p>
          </div>
          <a className="reservation-history-link" href="/my-tickets">Vé của tôi <span aria-hidden="true">↗</span></a>
        </div>

        {!session && (
          <div className="reservation-signin" role="status">
            <span className="signin-mark" aria-hidden="true">!</span>
            <div><strong>Cần đăng nhập để giữ vé</strong><p>Đăng nhập hoặc tạo tài khoản khách hàng trước khi tiếp tục.</p></div>
            <a href="/my-tickets">Đăng nhập</a>
          </div>
        )}

        {error && <p className="reservation-alert" role="alert">{error}</p>}
        {loading && <div className="reservation-state">Đang tải suất diễn đang mở bán…</div>}
        {!loading && showingsError && (
          <div className="reservation-state reservation-empty">
            <span aria-hidden="true">!</span>
            <h2>Không tải được suất diễn</h2>
            <p>Hệ thống chưa trả được dữ liệu bán vé.</p>
            <button className="reservation-retry" onClick={() => window.location.reload()}>Thử lại</button>
          </div>
        )}
        {!loading && !showingsError && showings.length === 0 && (
          <div className="reservation-state reservation-empty">
            <span aria-hidden="true">▱</span>
            <h2>Hiện chưa có suất diễn mở bán</h2>
            <p>Hãy quay lại sau khi sự kiện được mở bán.</p>
          </div>
        )}

        {!loading && selectedShowing && (
          <div className="reservation-layout">
            <section className="ticket-selection" aria-label="Chọn suất diễn và loại vé">
              <label className="showing-select-label" htmlFor="showing-select">Suất diễn</label>
              <select id="showing-select" value={showingId} onChange={(event) => changeShowing(event.target.value)} disabled={Boolean(activeHold)}>
                {showings.map((showing) => (
                  <option key={showing.id} value={showing.id}>
                    {showing.eventTitle} · {formatDate(showing.startsAt)}
                  </option>
                ))}
              </select>

              <div className="selected-event-meta">
                <div><span>ĐỊA ĐIỂM</span><strong>{selectedShowing.venue}, {selectedShowing.city}</strong></div>
                <div><span>BẮT ĐẦU</span><strong>{formatDate(selectedShowing.startsAt)}</strong></div>
              </div>

              <div className="ticket-section-heading"><h2>Loại vé</h2><span>Giá đã gồm thuế</span></div>
              <div className="ticket-options">
                {selectedShowing.ticketTypes.map((ticket) => {
                  const quantity = Number(quantities[ticket.id] || 0)
                  const unavailable = ticket.available < 1
                  return (
                    <article className={`ticket-option${unavailable ? ' unavailable' : ''}`} key={ticket.id}>
                      <div className="ticket-option-info">
                        <h3>{ticket.name}</h3>
                        <p>{unavailable ? 'Hết vé khả dụng' : `Còn ${ticket.available} vé`}</p>
                      </div>
                      <strong className="ticket-price">{formatMoney(ticket.priceVnd)}</strong>
                      <div className="quantity-control" aria-label={`Số lượng ${ticket.name}`}>
                        <button aria-label={`Giảm ${ticket.name}`} disabled={unavailable || quantity === 0 || Boolean(activeHold)} onClick={() => changeQuantity(ticket, -1)}>−</button>
                        <output>{quantity}</output>
                        <button aria-label={`Tăng ${ticket.name}`} disabled={unavailable || quantity >= ticket.available || totalQuantity >= 6 || Boolean(activeHold)} onClick={() => changeQuantity(ticket, 1)}>+</button>
                      </div>
                    </article>
                  )
                })}
              </div>
              <p className="ticket-limit-note">Tối đa 6 vé trong một phiếu giữ.</p>
            </section>

            <aside className="reservation-summary" aria-label="Tóm tắt phiếu giữ">
              {activeHold ? (
                <>
                  <p className="reservation-eyebrow">PHIẾU ĐANG GIỮ</p>
                  <h2>Thời gian còn lại</h2>
                  <div aria-live="polite" className="hold-countdown"><span>{minutes}</span><i>:</i><span>{seconds}</span></div>
                  <p className="hold-expiry">Hết hạn {formatDate(reservation.expiresAt)}</p>
                  <div className="summary-items">
                    {reservation.items.map((item) => (
                      <div className="summary-item" key={item.ticketTypeId}>
                        <span>{item.ticketType} × {item.quantity}</span>
                        <strong>{formatMoney(item.subtotalVnd)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="summary-total"><span>Tạm tính</span><strong>{formatMoney(reservation.totalAmountVnd)}</strong></div>
                  <a className="reservation-button reservation-button-primary" href={`/checkout?reservation=${encodeURIComponent(reservation.id)}`}>Tiếp tục xác nhận</a>
                  <button className="reservation-release" disabled={busy} onClick={releaseHold}>{busy ? 'Đang nhả vé…' : 'Bỏ giữ vé'}</button>
                  <p className="reservation-id">Mã phiếu: <code>{reservation.id}</code></p>
                </>
              ) : (
                <>
                  <p className="reservation-eyebrow">TÓM TẮT LỰA CHỌN</p>
                  <h2>Vé của bạn</h2>
                  {selectedItems.length === 0
                    ? <p className="summary-empty">Chọn số lượng vé để xem tóm tắt.</p>
                    : <div className="summary-items">
                      {selectedItems.map((item) => {
                        const ticket = selectedShowing.ticketTypes.find((entry) => entry.id === item.ticket_type_id)
                        return <div className="summary-item" key={item.ticket_type_id}><span>{ticket.name} × {item.quantity}</span><strong>{formatMoney(ticket.priceVnd * item.quantity)}</strong></div>
                      })}
                    </div>}
                  <div className="summary-total"><span>{totalQuantity} vé</span><strong>{formatMoney(totalAmount)}</strong></div>
                  <button className="reservation-button reservation-button-primary" disabled={busy || totalQuantity < 1 || !session} onClick={placeHold}>
                    {busy ? 'Đang giữ vé…' : 'Giữ vé trong 5 phút'}
                  </button>
                  <p className="summary-disclaimer">Chưa phát sinh thanh toán. Tồn vé sẽ được kiểm tra lại khi giữ.</p>
                </>
              )}
            </aside>
          </div>
        )}
      </main>

      <footer className="reservation-footer"><span>EventBox</span><span>Giữ vé tạm thời · Xác nhận đơn bằng transaction MySQL</span></footer>
    </div>
  )
}