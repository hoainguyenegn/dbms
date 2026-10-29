import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import './AdminEvents.css'
import EventCatalogEditor from '../components/EventCatalogEditor'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

export default function AdminEventsPage({ onBackToHome }) {
  const { token, user, openAuthModal } = useAuth()
  const [editingId, setEditingId] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [notification, setNotification] = useState({ type: '', message: '' })

  // Modal tạo sự kiện theo chuẩn Ticketbox
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formStep, setFormStep] = useState(1) // 1: Thông tin cơ bản, 2: Lịch diễn & Vé

  const [eventForm, setEventForm] = useState({
    event_code: '',
    title: '',
    category: 'MUSIC',
    description: '',
    venue_name: '',
    city_code: 'HCM',
    starts_at: '',
    ends_at: '',
    sales_start_at: '',
    sales_end_at: '',
    publish_now: true,
  })

  const [ticketTiers, setTicketTiers] = useState([
    { type_name: 'Vé Tiêu Chuẩn', price_vnd: 250000, capacity: 500 },
    { type_name: 'Vé VIP', price_vnd: 650000, capacity: 100 },
  ])

  const notify = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification({ message: '', type: '' }), 5000)
  }

  const fetchEvents = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const url = filterStatus === 'ALL'
        ? `${API_URL}/api/admin/events`
        : `${API_URL}/api/admin/events?status=${filterStatus}`

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      const data = await res.json()
      if (res.ok) {
        setEvents(data.events || [])
      } else {
        notify(data.message || 'Lỗi khi tải danh sách sự kiện', 'error')
      }
    } catch {
      notify('Không thể kết nối đến máy chủ', 'error')
    } finally {
      setLoading(false)
    }
  }, [token, filterStatus])

  useEffect(() => {
    const timer = setTimeout(fetchEvents, 0)
    return () => clearTimeout(timer)
  }, [fetchEvents])

  // Thêm / Xóa hạng vé trong form tạo
  const handleAddTicketTier = () => {
    setTicketTiers([
      ...ticketTiers,
      { type_name: `Hạng vé ${ticketTiers.length + 1}`, price_vnd: 300000, capacity: 200 },
    ])
  }

  const handleRemoveTicketTier = (index) => {
    if (ticketTiers.length <= 1) {
      alert('Sự kiện cần có ít nhất 1 loại vé.')
      return
    }
    setTicketTiers(ticketTiers.filter((_, i) => i !== index))
  }

  const handleUpdateTicketTier = (index, field, value) => {
    const updated = [...ticketTiers]
    updated[index][field] = value
    setTicketTiers(updated)
  }

  // Tạo sự kiện trọn gói theo quy trình Ticketbox
  const handleCreateFullEvent = async (e) => {
    e.preventDefault()

    if (!eventForm.event_code || !eventForm.title || !eventForm.venue_name || !eventForm.starts_at || !eventForm.ends_at) {
      notify('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'error')
      return
    }

    const payload = {
      event_code: eventForm.event_code.trim().toUpperCase(),
      title: eventForm.title.trim(),
      category: eventForm.category,
      description: eventForm.description.trim(),
      publish_now: eventForm.publish_now,
      showing: {
        showing_code: `${eventForm.event_code.trim().toUpperCase().slice(0, 29)}-S1`,
        venue_name: eventForm.venue_name.trim(),
        city_code: eventForm.city_code,
        starts_at: new Date(eventForm.starts_at).toISOString(),
        ends_at: new Date(eventForm.ends_at).toISOString(),
        sales_start_at: eventForm.sales_start_at
          ? new Date(eventForm.sales_start_at).toISOString()
          : new Date().toISOString(),
        sales_end_at: eventForm.sales_end_at
          ? new Date(eventForm.sales_end_at).toISOString()
          : new Date(eventForm.starts_at).toISOString(),
      },
      ticket_types: ticketTiers.map((t) => ({
        type_name: t.type_name.trim(),
        price_vnd: Number(t.price_vnd),
        capacity: Number(t.capacity),
      })),
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok) {
        notify(data.message)
        setShowCreateModal(false)
        setFormStep(1)
        setEventForm({
          event_code: '',
          title: '',
          category: 'MUSIC',
          description: '',
          venue_name: '',
          city_code: 'HCM',
          starts_at: '',
          ends_at: '',
          sales_start_at: '',
          sales_end_at: '',
          publish_now: true,
        })
        fetchEvents()
      } else {
        notify(data.message || 'Lỗi tạo sự kiện', 'error')
      }
    } catch {
      notify('Không thể kết nối đến máy chủ', 'error')
    }
  }

  // Mở bán sự kiện
  const handlePublish = async (eventId, eventCode) => {
    if (!confirm(`Xác nhận công bố mở bán cho sự kiện [${eventCode}]?`)) return
    try {
      const res = await fetch(`${API_URL}/api/admin/events/${eventId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        notify(data.message)
        fetchEvents()
      } else {
        notify(data.message || 'Không thể công bố sự kiện', 'error')
      }
    } catch {
      notify('Lỗi kết nối máy chủ', 'error')
    }
  }

  // Đóng bán vé
  const handleClose = async (eventId, eventCode) => {
    if (!confirm(`Xác nhận đóng sự kiện [${eventCode}]? Sau khi đóng sẽ ngừng bán vé.`)) return
    try {
      const res = await fetch(`${API_URL}/api/admin/events/${eventId}/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        notify(data.message)
        fetchEvents()
      } else {
        notify(data.message || 'Không thể đóng sự kiện', 'error')
      }
    } catch {
      notify('Lỗi kết nối máy chủ', 'error')
    }
  }

  // Xóa sự kiện nháp
  const handleDelete = async (eventId, eventCode) => {
    const event = events.find(item => item.id === eventId)
    if (!confirm(`Xóa ${event.title} [${eventCode}], ${event.showings_count} suất diễn và ${event.ticket_types_count} loại vé?`)) return
    try {
      const res = await fetch(`${API_URL}/api/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        notify(data.message)
        fetchEvents()
      } else {
        notify(data.message || 'Không thể xóa sự kiện', 'error')
      }
    } catch {
      notify('Lỗi kết nối máy chủ', 'error')
    }
  }

  // Nếu người dùng chưa có quyền Quản lý (Chặn theo nguyên tắc RBAC)
  if (user?.role !== 'MANAGER') {
    return (
      <div className="admin-container" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 480, margin: '60px auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Truy cập bị từ chối</h2>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Khu vực quản trị chỉ dành riêng cho tài khoản có vai trò Quản lý (MANAGER). Vui lòng đăng nhập bằng tài khoản có thẩm quyền để tiếp tục.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openAuthModal('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onBackToHome}
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-container">
      {/* Top Header */}
      <header className="admin-header">
        <div>
          <button className="btn-back" onClick={onBackToHome}>← Quay lại trang chủ</button>
          <h1 className="admin-page-title">Quản lý sự kiện</h1>
          <p className="admin-subtitle">Danh mục sự kiện, lịch biểu diễn và cấu hình mở bán vé</p>
        </div>
        <button className="btn-create-event" onClick={() => { setShowCreateModal(true); setFormStep(1); }}>
          + Tạo sự kiện mới
        </button>
      </header>

      {/* Notification Toast */}
      {notification.message && (
        <div className={`admin-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="admin-filters">
        {['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED'].map((st) => (
          <button
            key={st}
            type="button"
            className={`admin-filter-btn ${filterStatus === st ? 'active' : ''}`}
            onClick={() => setFilterStatus(st)}
          >
            {st === 'ALL' ? 'Tất cả' :
             st === 'DRAFT' ? 'Bản nháp' :
             st === 'PUBLISHED' ? 'Đang mở bán' : 'Đã đóng'}
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="admin-table-card">
        {loading ? (
          <div className="admin-loading">Đang tải danh sách sự kiện...</div>
        ) : events.length === 0 ? (
          <div className="admin-empty">Không có sự kiện nào trong danh mục.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>MÃ SỰ KIỆN</th>
                <th>TÊN SỰ KIỆN</th>
                <th>THỂ LOẠI</th>
                <th>TRẠNG THÁI</th>
                <th>SUẤT DIỄN</th>
                <th>TỔNG SỨC CHỨA</th>
                <th>ĐÃ BÁN</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td><strong>{evt.event_code}</strong><br /><button type="button" onClick={() => setEditingId(evt.id)}>Chi tiết / Chỉnh sửa</button></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{evt.title}</div>
                    {evt.description && <small style={{ color: '#64748b' }}>{evt.description.slice(0, 50)}...</small>}
                  </td>
                  <td><span className="badge-cat">{evt.category}</span></td>
                  <td>
                    <span className={`status-badge status-${evt.status.toLowerCase()}`}>
                      {evt.status === 'DRAFT' ? 'Bản nháp' :
                       evt.status === 'PUBLISHED' ? 'Đang mở bán' : 'Đã đóng'}
                    </span>
                  </td>
                  <td>{evt.showings_count} suất</td>
                  <td>{evt.total_capacity} vé</td>
                  <td><strong>{evt.total_sold_tickets}</strong></td>
                  <td>
                    <div className="action-buttons">
                      {evt.status === 'DRAFT' && (
                        <>
                          <button
                            className="btn-action btn-publish"
                            onClick={() => handlePublish(evt.id, evt.event_code)}
                            title="Công bố mở bán ngay"
                          >
                            Mở bán
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDelete(evt.id, evt.event_code)}
                            title="Xóa sự kiện nháp"
                          >
                            Xóa
                          </button>
                        </>
                      )}

                      {evt.status === 'PUBLISHED' && (
                        <button
                          className="btn-action btn-close"
                          onClick={() => handleClose(evt.id, evt.event_code)}
                          title="Đóng bán vé"
                        >
                          Đóng bán
                        </button>
                      )}

                      {evt.status === 'CLOSED' && (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Đã kết thúc</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Tạo sự kiện trọn gói theo chuẩn Ticketbox */}
      {editingId && <EventCatalogEditor eventId={editingId} token={token} onClose={() => setEditingId(null)} onChanged={fetchEvents} />}
      {showCreateModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="admin-modal-card" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Tạo sự kiện mới</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Stepper trong Form */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setFormStep(1)}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 13,
                  borderBottom: formStep === 1 ? '2px solid #e63946' : 'none',
                  color: formStep === 1 ? '#e63946' : '#64748b',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
              >
                1. Thông tin sự kiện
              </button>
              <button
                type="button"
                onClick={() => setFormStep(2)}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: 13,
                  borderBottom: formStep === 2 ? '2px solid #e63946' : 'none',
                  color: formStep === 2 ? '#e63946' : '#64748b',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
              >
                2. Lịch diễn & Hạng vé
              </button>
            </div>

            <form onSubmit={handleCreateFullEvent} className="admin-modal-form">
              {formStep === 1 && (
                <>
                  <div className="form-group">
                    <label>Tên sự kiện *</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đại Nhạc Hội Mùa Thu 2026"
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Mã sự kiện (Viết hoa, duy nhất) *</label>
                      <input
                        type="text"
                        placeholder="EVT-AUTUMN-2026"
                        value={eventForm.event_code}
                        onChange={(e) => setEventForm({ ...eventForm, event_code: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Thể loại *</label>
                      <select
                        value={eventForm.category}
                        onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                      >
                        <option value="MUSIC">Âm nhạc</option>
                        <option value="THEATER">Sân khấu & Nghệ thuật</option>
                        <option value="SPORTS">Thể thao</option>
                        <option value="WORKSHOP">Hội thảo</option>
                        <option value="FESTIVAL">Lễ hội</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Mô tả chi tiết sự kiện</label>
                    <textarea
                      rows="3"
                      placeholder="Giới thiệu nội dung chương trình, nghệ sĩ biểu diễn..."
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    />
                  </div>

                  <div className="admin-modal-actions">
                    <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)}>Hủy</button>
                    <button type="button" className="btn-primary" onClick={() => setFormStep(2)}>
                      Tiếp theo: Lịch diễn & Hạng vé →
                    </button>
                  </div>
                </>
              )}

              {formStep === 2 && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Địa điểm tổ chức *</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Nhà hát Hòa Bình"
                        value={eventForm.venue_name}
                        onChange={(e) => setEventForm({ ...eventForm, venue_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Thành phố *</label>
                      <select
                        value={eventForm.city_code}
                        onChange={(e) => setEventForm({ ...eventForm, city_code: e.target.value })}
                      >
                        <option value="HCM">TP. Hồ Chí Minh</option>
                        <option value="HN">Hà Nội</option>
                        <option value="DN">Đà Nẵng</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group"><label>Mở bán (bỏ trống để dùng thời điểm hiện tại)</label>
                      <input type="datetime-local" value={eventForm.sales_start_at} onChange={e => setEventForm({ ...eventForm, sales_start_at: e.target.value })} />
                    </div>
                    <div className="form-group"><label>Ngừng bán (bỏ trống để dùng giờ bắt đầu diễn)</label>
                      <input type="datetime-local" value={eventForm.sales_end_at} onChange={e => setEventForm({ ...eventForm, sales_end_at: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Thời gian bắt đầu *</label>
                      <input
                        type="datetime-local"
                        value={eventForm.starts_at}
                        onChange={(e) => setEventForm({ ...eventForm, starts_at: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Thời gian kết thúc *</label>
                      <input
                        type="datetime-local"
                        value={eventForm.ends_at}
                        onChange={(e) => setEventForm({ ...eventForm, ends_at: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Thiết lập các hạng vé */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Các hạng vé mở bán</label>
                      <button
                        type="button"
                        onClick={handleAddTicketTier}
                        style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        + Thêm hạng vé
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ticketTiers.map((tier, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', padding: 8, borderRadius: 8 }}>
                          <input
                            type="text"
                            placeholder="Tên hạng vé"
                            value={tier.type_name}
                            onChange={(e) => handleUpdateTicketTier(idx, 'type_name', e.target.value)}
                            style={{ flex: 2, padding: '7px 10px', fontSize: 13 }}
                            required
                          />
                          <input
                            type="number"
                            placeholder="Giá (VND)" min="0" max="1000000000" step="1"
                            value={tier.price_vnd}
                            onChange={(e) => handleUpdateTicketTier(idx, 'price_vnd', e.target.value)}
                            style={{ flex: 2, padding: '7px 10px', fontSize: 13 }}
                            required
                          />
                          <input
                            type="number"
                            placeholder="Số lượng vé" min="1" max="100000" step="1"
                            value={tier.capacity}
                            onChange={(e) => handleUpdateTicketTier(idx, 'capacity', e.target.value)}
                            style={{ flex: 1.5, padding: '7px 10px', fontSize: 13 }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveTicketTier(idx)}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', fontWeight: 700 }}
                            title="Xóa hạng vé này"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: '#ecfdf5', padding: '10px 14px', borderRadius: 8 }}>
                    <input
                      id="cb-publish"
                      type="checkbox"
                      checked={eventForm.publish_now}
                      onChange={(e) => setEventForm({ ...eventForm, publish_now: e.target.checked })}
                      style={{ width: 16, height: 16 }}
                    />
                    <label htmlFor="cb-publish" style={{ fontSize: 13, fontWeight: 600, color: '#047857', cursor: 'pointer' }}>
                      Công bố mở bán ngay lập tức trên trang chủ
                    </label>
                  </div>

                  <div className="admin-modal-actions">
                    <button type="button" className="btn-ghost" onClick={() => setFormStep(1)}>← Quay lại</button>
                    <button type="submit" className="btn-primary">
                      {eventForm.publish_now ? 'Tạo và Mở bán ngay' : 'Lưu bản nháp'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
