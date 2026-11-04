import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import './ReservationPage.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const ACTIVE_RESERVATION_KEY = 'eventbox-active-reservation'
const REQUEST_KEY = 'eventbox-reservation-request'

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
  if (!response.ok) throw Object.assign(new Error(data?.message || 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.'), { status: response.status })
  return data
}
const formatMoney = value => `${new Intl.NumberFormat('vi-VN').format(value || 0)} đ`
const formatDate = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
function readStoredReservation() {
  try { return sessionStorage.getItem(ACTIVE_RESERVATION_KEY) || '' } catch { return '' }
}
function readPendingRequest() {
  try { return JSON.parse(sessionStorage.getItem(REQUEST_KEY) || 'null') } catch { return null }
}

export default function ReservationPage() {
  const { user, token, loading: authLoading, openAuthModal } = useAuth()
  const canBook = user?.role === 'USER' && Boolean(token)
  const [showings, setShowings] = useState([])
  const [showingId, setShowingId] = useState(() => new URLSearchParams(window.location.search).get('showing') || '')
  const [quantities, setQuantities] = useState({})
  const [reservation, setReservation] = useState(null)
  const [reservationToken, setReservationToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [storedReservationId] = useState(readStoredReservation)
  const [restoredToken, setRestoredToken] = useState(null)
  const restoringHold = canBook && storedReservationId && restoredToken !== token
  const expired = reservation?.status === 'ACTIVE' && new Date(reservation.expiresAt).getTime() <= now
  const activeHold = canBook && reservationToken === token && reservation?.status === 'ACTIVE' && !expired

  useEffect(() => {
    const controller = new AbortController()
    request('/api/showings/on-sale', { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return
        setShowings(data.items)
        setShowingId(current => current || String(data.items[0]?.id || ''))
        setLoadError('')
      })
      .catch(err => {
        if (err.name !== 'AbortError') setLoadError('Không tải được danh sách vé. Vui lòng thử lại.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [loadVersion, expired])

  useEffect(() => {
    if (!token || user?.role !== 'USER' || !storedReservationId) return undefined
    const controller = new AbortController()
    request(`/api/reservations/${encodeURIComponent(storedReservationId)}`, { token, signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return
        if (data.reservation.status === 'ACTIVE') {
          setReservation(data.reservation)
          setReservationToken(token)
          setShowingId(String(data.reservation.showingId))
        } else {
          setReservation(null)
          sessionStorage.removeItem(ACTIVE_RESERVATION_KEY)
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        if ([401, 403, 404].includes(err.status)) { setReservation(null); sessionStorage.removeItem(ACTIVE_RESERVATION_KEY) }
        else setError('Chưa thể tải vé đang giữ. Vui lòng tải lại trang để thử lại.')
      })
      .finally(() => { if (!controller.signal.aborted) setRestoredToken(token) })
    return () => controller.abort()
  }, [token, user?.role, storedReservationId])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const selectedShowing = showings.find(item => String(item.id) === showingId)
  const selectedItems = selectedShowing?.ticketTypes
    .filter(ticket => Number(quantities[ticket.id]) > 0)
    .map(ticket => ({ ticket_type_id: ticket.id, quantity: Number(quantities[ticket.id]) })) || []
  const totalQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0)
  const totalAmount = selectedItems.reduce((total, item) => total + item.quantity * selectedShowing.ticketTypes.find(ticket => ticket.id === item.ticket_type_id).priceVnd, 0)
  const secondsLeft = reservation ? Math.max(0, Math.ceil((new Date(reservation.expiresAt).getTime() - now) / 1000)) : 0
  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  const title = activeHold ? reservation.event?.title || selectedShowing?.eventTitle : selectedShowing?.eventTitle
  const startsAt = activeHold ? reservation.showing?.startsAt || selectedShowing?.startsAt : selectedShowing?.startsAt
  const venue = activeHold ? reservation.showing?.venue || selectedShowing?.venue : selectedShowing?.venue
  const city = activeHold ? reservation.showing?.city || selectedShowing?.city : selectedShowing?.city

  function changeQuantity(ticket, delta) {
    const current = Number(quantities[ticket.id] || 0)
    const next = Math.max(0, Math.min(Number(ticket.available), current + delta))
    if (totalQuantity - current + next > 6) return
    setError('')
    setQuantities(values => ({ ...values, [ticket.id]: next }))
  }
  function reloadShowings() {
    setLoading(true)
    setLoadError('')
    setLoadVersion(version => version + 1)
  }
  async function placeHold() {
    if (!canBook) { openAuthModal('login'); return }
    if (!selectedShowing || totalQuantity < 1 || totalQuantity > 6) { setError('Vui lòng chọn từ 1 đến 6 vé.'); return }
    setBusy(true)
    setError('')
    const fingerprint = `${user.id}:${selectedShowing.id}:${JSON.stringify(selectedItems)}`
    try {
      const saved = readPendingRequest()
      const requestKey = saved?.fingerprint === fingerprint ? saved.requestKey : crypto.randomUUID()
      sessionStorage.setItem(REQUEST_KEY, JSON.stringify({ fingerprint, requestKey }))
      const data = await request('/api/reservations', {
        token, method: 'POST', body: JSON.stringify({ request_key: requestKey, showing_id: selectedShowing.id, items: selectedItems }),
      })
      setReservation(data.reservation)
      setReservationToken(token)
      sessionStorage.setItem(ACTIVE_RESERVATION_KEY, data.reservation.id)
      sessionStorage.removeItem(REQUEST_KEY)
      window.location.assign(`/checkout?reservation=${encodeURIComponent(data.reservation.id)}`)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function releaseHold() {
    if (!reservation || !canBook) return
    setBusy(true)
    setError('')
    try {
      const data = await request(`/api/reservations/${encodeURIComponent(reservation.id)}/release`, { token, method: 'POST' })
      setReservation(data.reservation)
      sessionStorage.removeItem(ACTIVE_RESERVATION_KEY)
      setQuantities({})
      reloadShowings()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const summaryItems = activeHold ? reservation.items : selectedItems.map(item => {
    const ticket = selectedShowing.ticketTypes.find(entry => entry.id === item.ticket_type_id)
    return { ticketTypeId: ticket.id, ticketType: ticket.name, quantity: item.quantity, subtotalVnd: ticket.priceVnd * item.quantity }
  })

  return <div className="reservation-app">
    <main className="reservation-main">
      <a className="reservation-back" href="/">← Sự kiện</a>
      <div className="reservation-heading"><h1>Chọn vé</h1><p>Chọn loại vé và số lượng cho sự kiện của bạn.</p></div>
      {error && <p className="reservation-alert" role="alert">{error}</p>}
      {expired && <p className="reservation-notice" role="status">Thời gian giữ vé đã hết. Bạn có thể chọn vé để đặt lại.</p>}
      {!authLoading && user?.role === 'MANAGER' && <p className="reservation-notice">Chức năng đặt vé dành cho tài khoản khách hàng. <a href="/admin/events">Quản lý sự kiện</a></p>}
      {loading || restoringHold ? <div className="reservation-state" role="status">Đang tải vé...</div> : loadError && !activeHold ? <div className="reservation-state"><h2>Chưa thể tải vé</h2><p>{loadError}</p><button type="button" className="reservation-secondary" onClick={reloadShowings}>Thử lại</button></div> : !selectedShowing && !activeHold ? <div className="reservation-state"><h2>Suất diễn chưa mở bán hoặc đã ngừng bán</h2><p>Vui lòng chọn một sự kiện khác.</p><a className="reservation-secondary" href="/">Khám phá sự kiện</a></div> : <div className="reservation-layout">
        <section className="ticket-selection" aria-label="Chọn loại vé">
          {showings.length > 1 && !activeHold && <div className="showing-choice"><label htmlFor="showing-select">Suất diễn</label><select id="showing-select" value={showingId} disabled={busy} onChange={event => { setShowingId(event.target.value); setQuantities({}); setError('') }}>{showings.map(showing => <option key={showing.id} value={showing.id}>{showing.eventTitle} · {formatDate(showing.startsAt)}</option>)}</select></div>}
          <div className="reservation-event"><h2>{title}</h2>{startsAt && <p>{formatDate(startsAt)}</p>}<p>{venue}{city ? ` · ${city}` : ''}</p></div>
          {activeHold ? <div className="held-ticket-list">{reservation.items.map(item => <div className="held-ticket-row" key={item.ticketTypeId}><span>{item.ticketType}</span><strong>{item.quantity} vé</strong></div>)}</div> : <>
            <div className="ticket-options">{selectedShowing.ticketTypes.map(ticket => {
              const quantity = Number(quantities[ticket.id] || 0)
              const soldOut = ticket.available < 1
              return <article className={`ticket-option${soldOut ? ' is-sold-out' : ''}`} key={ticket.id}>
                <div className="ticket-option-info"><h3>{ticket.name}</h3><p>{formatMoney(ticket.priceVnd)}</p>{soldOut && <span>Hết vé</span>}</div>
                <div className="quantity-control" role="group" aria-label={`Số lượng vé ${ticket.name}`}><button type="button" aria-label={`Giảm ${ticket.name}`} disabled={busy || quantity === 0} onClick={() => changeQuantity(ticket, -1)}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label={`Tăng ${ticket.name}`} disabled={busy || soldOut || quantity >= ticket.available || totalQuantity >= 6} onClick={() => changeQuantity(ticket, 1)}>+</button></div>
              </article>
            })}</div>
            <p className="ticket-limit-note">Tối đa 6 vé mỗi lần đặt.</p>
          </>}
        </section>
        <aside className="reservation-summary" aria-label="Tóm tắt đơn vé">
          <h2>Đơn vé của bạn</h2>
          {activeHold && <div className="hold-timer"><span>Thời gian giữ vé còn lại</span><strong role="timer" aria-label={`Còn ${Math.floor(secondsLeft / 60)} phút ${secondsLeft % 60} giây`}>{countdown}</strong></div>}
          {summaryItems.length ? <div className="summary-items">{summaryItems.map(item => <div className="summary-item" key={item.ticketTypeId}><span>{item.ticketType} <small>× {item.quantity}</small></span><strong>{formatMoney(item.subtotalVnd)}</strong></div>)}</div> : <p className="summary-empty">Chọn vé để xem tổng tiền.</p>}
          <div className="summary-total"><span>Tổng cộng</span><strong>{formatMoney(activeHold ? reservation.totalAmountVnd : totalAmount)}</strong></div>
          {activeHold ? <>
            <a className="reservation-primary" href={`/checkout?reservation=${encodeURIComponent(reservation.id)}`}>Tiếp tục</a>
            <button type="button" className="reservation-release" disabled={busy} onClick={releaseHold}>{busy ? 'Đang xử lý...' : 'Bỏ giữ vé và chọn lại'}</button>
          </> : !authLoading && !user ? <button type="button" className="reservation-primary" onClick={() => openAuthModal('login')}>Đăng nhập để tiếp tục</button> : <button type="button" className="reservation-primary" disabled={authLoading || busy || totalQuantity < 1 || !canBook} onClick={placeHold}>{busy ? 'Đang xử lý...' : 'Giữ vé và tiếp tục'}</button>}
          {!activeHold && <p className="reservation-note">Vé sẽ được giữ tối đa 5 phút để bạn xác nhận.</p>}
        </aside>
      </div>}
    </main>
  </div>
}
