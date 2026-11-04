import { useEffect, useState } from 'react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const dates = ['sales_start_at', 'sales_end_at', 'starts_at', 'ends_at']
const labels = { title: 'Tên sự kiện', category: 'Thể loại', description: 'Mô tả', showing_code: 'Mã suất diễn', venue_name: 'Địa điểm', city_code: 'Mã thành phố', sales_start_at: 'Mở bán', sales_end_at: 'Ngừng bán', starts_at: 'Bắt đầu diễn', ends_at: 'Kết thúc diễn', type_name: 'Tên loại vé', price_vnd: 'Giá vé (VND)', capacity: 'Số lượng' }
const blankShowing = { showing_code: '', venue_name: '', city_code: 'HCM', sales_start_at: '', sales_end_at: '', starts_at: '', ends_at: '' }
const blankTicket = { type_name: '', price_vnd: 0, capacity: 1 }
function localTime(value) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export default function EventCatalogEditor({ eventId, token, onClose, onChanged }) {
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/api/admin/events/${eventId}`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.message || 'Không thể tải sự kiện.')
        setError('')
        setEvent(body.event)
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [eventId, token, revision])
  const edit = (path, values, title, method = 'PATCH') => {
    setError('')
    setForm({ path, values, title, method })
  }
  const mutate = async (path, method, values) => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(values ? { body: JSON.stringify(values) } : {}),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Không thể lưu thay đổi.')
      setForm(null); setRevision(value => value + 1); onChanged()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const submit = e => {
    e.preventDefault()
    const values = { ...form.values }
    for (const key of dates) if (key in values) values[key] = new Date(values[key]).toISOString()
    for (const key of ['price_vnd', 'capacity']) if (key in values) values[key] = Number(values[key])
    mutate(form.path, form.method, values)
  }
  return <div className="admin-modal-backdrop"><div className="admin-modal-card admin-modal-form" role="dialog" aria-modal="true" aria-label="Quản lý danh mục" style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: 850 }}>
    <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error} <button type="button" onClick={() => setRevision(value => value + 1)}>Tải lại</button></p>}
    {!event ? <p>Đang tải danh mục...</p> : <>
      <h2>{event.title} ({event.event_code})</h2>
      <p>Trạng thái: {event.status}</p>
      {event.status === 'DRAFT' && <>
        <button className="btn-ghost" disabled={busy} onClick={() => edit(`events/${event.id}`, { title: event.title, category: event.category, description: event.description || '' }, 'Sửa sự kiện')}>Sửa thông tin sự kiện</button>
        <button className="btn-primary" disabled={busy} onClick={() => edit(`events/${event.id}/showings`, { ...blankShowing }, 'Thêm suất diễn', 'POST')}>Thêm suất diễn</button>
      </>}
      {event.showings.map(showing => <section key={showing.id} style={{ borderTop: '1px solid #ddd', marginTop: 16, paddingTop: 12 }}>
        <h3>{showing.showing_code} — {showing.venue_name} ({showing.city_code})</h3>
        <p>{new Date(showing.starts_at).toLocaleString('vi-VN')} → {new Date(showing.ends_at).toLocaleString('vi-VN')}</p>
        <p>Mở bán: {new Date(showing.sales_start_at).toLocaleString('vi-VN')} — Ngừng bán: {new Date(showing.sales_end_at).toLocaleString('vi-VN')}</p>
        {event.status === 'DRAFT' && <>
          <button disabled={busy} onClick={() => {
            const values = { venue_name: showing.venue_name, city_code: showing.city_code }
            for (const key of dates) values[key] = localTime(showing[key])
            edit(`events/${event.id}/showings/${showing.id}`, values, 'Sửa suất diễn')
          }}>Sửa suất diễn</button>{' '}
          <button disabled={busy} onClick={() => {
            if (confirm(`Xóa suất ${showing.showing_code} và ${showing.ticket_types.length} loại vé?`)) mutate(`events/${event.id}/showings/${showing.id}`, 'DELETE')
          }}>Xóa suất diễn</button>{' '}
          <button disabled={busy} onClick={() => edit(`showings/${showing.id}/ticket-types`, { ...blankTicket }, 'Thêm loại vé', 'POST')}>Thêm loại vé</button>
        </>}
        {showing.ticket_types.map(ticket => <div key={ticket.id} style={{ margin: '10px 0' }}>
          {ticket.type_name}: {Number(ticket.price_vnd).toLocaleString('vi-VN')} đ — {ticket.capacity} vé{' '}
          {event.status === 'DRAFT' && <>
            <button disabled={busy} onClick={() => edit(`showings/${showing.id}/ticket-types/${ticket.id}`, { type_name: ticket.type_name, price_vnd: ticket.price_vnd, capacity: ticket.capacity }, 'Sửa loại vé')}>Sửa</button>{' '}
            <button disabled={busy} onClick={() => { if (confirm(`Xóa loại vé ${ticket.type_name}?`)) mutate(`showings/${showing.id}/ticket-types/${ticket.id}`, 'DELETE') }}>Xóa</button>
          </>}
        </div>)}
      </section>)}
    </>}
    {form && <form onSubmit={submit} style={{ borderTop: '2px solid #ddd', paddingTop: 12, marginTop: 16 }}>
      <h3>{form.title}</h3>
      {Object.entries(form.values).map(([key, value]) => <div className="form-group" key={key}>
        <label htmlFor={`catalog-${key}`}>{labels[key]}</label>
        <input id={`catalog-${key}`} type={dates.includes(key) ? 'datetime-local' : ['price_vnd', 'capacity'].includes(key) ? 'number' : 'text'}
          required={key !== 'description'} maxLength={{ title: 200, category: 50, showing_code: 32, venue_name: 150, city_code: 10, type_name: 50 }[key]}
          min={key === 'price_vnd' ? 0 : key === 'capacity' ? 1 : undefined} max={key === 'price_vnd' ? 1000000000 : key === 'capacity' ? 100000 : undefined}
          step={['price_vnd', 'capacity'].includes(key) ? 1 : undefined} value={value}
          onChange={e => setForm({ ...form, values: { ...form.values, [key]: e.target.value } })} />
      </div>)}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu'}</button>{' '}
      <button type="button" className="btn-ghost" disabled={busy} onClick={() => setForm(null)}>Hủy</button>
    </form>}
  </div></div>
}
