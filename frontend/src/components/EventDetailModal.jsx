import { useEffect, useState } from 'react'
import './EventModal.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const formatDate = value => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const formatPrice = value => `${Number(value).toLocaleString('vi-VN')} đ`

export default function EventDetailModal({ eventId, onClose, onSelectTicket }) {
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedShowingId, setSelectedShowingId] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/api/events/${eventId}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.message || 'Chưa tải được thông tin sự kiện.')
        if (controller.signal.aborted) return
        setData(body.event)
        setSelectedShowingId(body.event.showings.find(showing => showing.can_reserve)?.id || body.event.showings[0]?.id || null)
      })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [eventId, revision])
  useEffect(() => {
    const previous = document.activeElement
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.getElementById('event-detail-close')?.focus({ preventScroll: true })
    const onKey = event => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = [...document.querySelectorAll('.evt-modal button:not(:disabled), .evt-modal summary')]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', onKey); previous?.focus?.({ preventScroll: true }) }
  }, [onClose])
  const showing = data?.showings?.find(item => item.id === selectedShowingId)
  return <div className="evt-backdrop" onClick={onClose}>
    <section className="evt-modal" role="dialog" aria-modal="true" aria-label="Chi tiết sự kiện" onClick={event => event.stopPropagation()}>
      <button id="event-detail-close" type="button" className="evt-close-btn" onClick={onClose} aria-label="Đóng chi tiết">×</button>
      {loading ? <div className="evt-state" role="status">Đang tải sự kiện...</div> : error ? <div className="evt-state" role="alert"><p>{error}</p><button className="btn-primary" onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1) }}>Thử lại</button></div> : data && <>
        <div className="evt-header"><h2>{data.title}</h2>{data.description && <details className="evt-description"><summary>Giới thiệu sự kiện</summary><p>{data.description}</p></details>}</div>
        <div className="evt-body">
          {data.showings.length > 1 && <div className="showing-selector" role="group" aria-label="Chọn suất diễn">{data.showings.map(item => <button key={item.id} type="button" className={`showing-chip ${item.id === selectedShowingId ? 'active' : ''}`} aria-pressed={item.id === selectedShowingId} onClick={() => setSelectedShowingId(item.id)}>{formatDate(item.starts_at)}<span>{item.city_code}</span></button>)}</div>}
          {showing ? <>
            <div className="showing-meta"><p>{formatDate(showing.starts_at)}</p><p>{showing.venue_name}, {showing.city_code}</p></div>
            <div className="ticket-types-list">{showing.ticket_types.map(ticket => <div className="ticket-type-card" key={ticket.id}><div><strong>{ticket.type_name}</strong><p>{ticket.available_capacity > 0 ? `Còn ${ticket.available_capacity} vé` : 'Hết vé'}</p></div><span>{formatPrice(ticket.price_vnd)}</span></div>)}</div>
            {showing.sales_status !== 'OPEN' && <p className="evt-sale-note">{showing.sales_status === 'UPCOMING' ? `Mở bán từ ${formatDate(showing.sales_start_at)}` : 'Suất diễn đã ngừng bán vé.'}</p>}
            <button type="button" className="evt-book-button" disabled={!showing.can_reserve} onClick={() => { onSelectTicket?.(data, showing); onClose() }}>{showing.can_reserve ? 'Chọn vé' : 'Chưa thể đặt vé'}</button>
          </> : <p className="evt-sale-note">Chưa có lịch diễn.</p>}
        </div>
      </>}
    </section>
  </div>
}
