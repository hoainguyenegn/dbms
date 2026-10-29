import { useState, useEffect } from 'react'
import './EventModal.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

export default function EventDetailModal({ eventId, onClose, onSelectTicket }) {
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedShowingId, setSelectedShowingId] = useState(null)

  useEffect(() => {
    if (!eventId) return

    let active = true
    const controller = new AbortController()
    fetch(`${API_URL}/api/events/${eventId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải chi tiết sự kiện.')
        return res.json()
      })
      .then((resData) => {
        if (!active) return
        setData(resData.event)
        if (resData.event?.showings?.length > 0) {
          setSelectedShowingId(resData.event.showings[0].id)
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') setError(err.message || 'Lỗi kết nối khi tải sự kiện.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false; controller.abort() }
  }, [eventId, revision])

  if (!eventId) return null

  const currentShowing = data?.showings?.find((s) => s.id === selectedShowingId)

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ'
  }

  const formatDateTime = (isoStr) => {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    return d.toLocaleString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="evt-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="evt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="evt-close-btn" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        {loading && (
          <div className="evt-loading-state">
            <div className="evt-spinner" />
            <p>Đang tải thông tin sự kiện và tình trạng vé...</p>
          </div>
        )}

        {error && (
          <div className="evt-error-state">
            <h3>Không thể tải sự kiện</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1) }}>Thử lại</button>
            <button className="btn-primary" onClick={onClose} style={{ marginTop: 12 }}>
              Quay lại
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="evt-header">
              <span className="evt-category-badge">{data.category}</span>
              <h2 className="evt-title">{data.title}</h2>
              <p className="evt-code">Mã sự kiện: <strong>{data.event_code}</strong></p>
              {data.description && <p className="evt-desc">{data.description}</p>}
            </div>

            <div className="evt-body">
              <p>Số lượng vé được cập nhật tại lúc tải trang; hệ thống sẽ kiểm tra lại khi giữ vé.</p>
              <h3 className="evt-section-heading">Lịch biểu diễn & Suất tổ chức</h3>

              {data.showings?.length === 0 ? (
                <p className="evt-empty">Chưa có suất diễn nào được mở bán.</p>
              ) : (
                <>
                  <div className="showing-selector">
                    {data.showings.map((showing) => (
                      <button
                        key={showing.id}
                        type="button"
                        className={`showing-chip ${selectedShowingId === showing.id ? 'active' : ''}`}
                        onClick={() => setSelectedShowingId(showing.id)}
                      >
                        <span className="showing-city">{showing.city_code}</span>
                        <span className="showing-date">{formatDateTime(showing.starts_at)}</span>
                      </button>
                    ))}
                  </div>

                  {currentShowing && (
                    <div className="showing-detail-box">
                      <div className="showing-meta">
                        <div>
                          <strong>Địa điểm:</strong> {currentShowing.venue_name} ({currentShowing.city_code})
                        </div>
                        <div>
                          <strong>Thời gian diễn:</strong> {formatDateTime(currentShowing.starts_at)} → {formatDateTime(currentShowing.ends_at)}
                        </div>
                        <div>
                          <strong>Thời hạn bán vé:</strong> Đến {formatDateTime(currentShowing.sales_end_at)}
                        </div>
                        <div>
                          <strong>Tình trạng mở bán:</strong>{' '}
                          <span className={`status-pill status-${currentShowing.sales_status.toLowerCase()}`}>
                            {currentShowing.sales_status === 'OPEN' ? 'Đang mở bán' :
                             currentShowing.sales_status === 'UPCOMING' ? 'Sắp mở bán' :
                             currentShowing.sales_status === 'STOPPED' ? 'Đã ngừng bán' : 'Đã kết thúc'}
                          </span>
                        </div>
                      </div>

                      <h4 className="ticket-types-heading">Các hạng vé và số lượng khả dụng</h4>
                      <div className="ticket-types-list">
                        {currentShowing.ticket_types?.map((tt) => (
                          <div key={tt.id} className="ticket-type-card">
                            <div className="tt-info">
                              <span className="tt-name">{tt.type_name}</span>
                              <span className="tt-price">{formatPrice(tt.price_vnd)}</span>
                            </div>
                            <div className="tt-capacity">
                              <span>Tồn khả dụng: <strong>{tt.available_capacity}</strong> / {tt.capacity} vé</span>
                              <span className="tt-sold">Đã bán: {tt.sold_quantity}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="evt-footer-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!currentShowing.can_reserve}
                          onClick={() => {
                            if (onSelectTicket) onSelectTicket(data, currentShowing)
                            onClose()
                          }}
                        >
                          {currentShowing.can_reserve ? 'Chọn vé ngay →' : 'Tạm thời không khả dụng'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
