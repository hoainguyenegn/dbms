import { useState, useEffect } from 'react'
import { useAuth } from '../context/useAuth'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const formatNumber = value => Number(value).toLocaleString('vi-VN')
const formatDate = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const initialFilters = { from: '', to: '', eventId: '', showingId: '', ticketTypeId: '' }

export default function StatsPage() {
  const { token, user, loading: authLoading, openAuthModal } = useAuth()
  const [filters, setFilters] = useState(initialFilters)
  const [request, setRequest] = useState({ query: '', revision: 0 })
  const [result, setResult] = useState(null)
  const isManager = user?.role === 'MANAGER'

  useEffect(() => {
    if (authLoading || !token || !isManager) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`${API_URL}/api/admin/stats?${request.query}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        })
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.message || 'Không thể tải thống kê.')
        if (!controller.signal.aborted) setResult({ request, token, data: body.stats })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ request, token, error: error.message })
      }
    }
    load()
    return () => controller.abort()
  }, [authLoading, token, isManager, request])

  if (authLoading) return <p role="status">Đang kiểm tra tài khoản…</p>
  if (!isManager) return <section style={{ padding: 32 }}>
    <h1>Báo cáo dành cho quản lý</h1>
    {!user && <button onClick={() => openAuthModal('login')}>Đăng nhập</button>}
    {user && <p>Bạn không có quyền xem báo cáo này.</p>}
  </section>

  const current = result?.request === request && result?.token === token
  const data = current ? result.data : null
  const error = current ? result.error : null
  function submit(event) {
    event.preventDefault()
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
    setRequest(previous => ({ query: params.toString(), revision: previous.revision + 1 }))
  }
  return <section style={{ maxWidth: 1200, margin: '32px auto', padding: 24 }}>
    <h1>Thống kê đặt vé</h1>
    <p>Chỉ tính đơn đã xác nhận. Bộ lọc ngày áp dụng theo giờ bắt đầu buổi tổ chức, múi giờ Việt Nam, gồm cả ngày kết thúc.</p>
    <form onSubmit={submit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
      {Object.entries({ from: 'Từ ngày', to: 'Đến ngày', eventId: 'ID sự kiện', showingId: 'ID buổi', ticketTypeId: 'ID loại vé' }).map(([key, label]) =>
        <label key={key}>{label}<br /><input type={key === 'from' || key === 'to' ? 'date' : 'number'} min={key.endsWith('Id') ? '1' : undefined}
          value={filters[key]} onChange={event => setFilters(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
      <button type="submit">Áp dụng / Làm mới</button>
    </form>
    {!current && <p role="status">Đang tải báo cáo…</p>}
    {error && <p role="alert">Không tải được báo cáo: {error}</p>}
    {data && <>
      <p><strong>{formatNumber(data.confirmedTickets)} vé đã xác nhận</strong> · Tổng giá trị: <strong>{formatNumber(data.totalRevenueVnd)} đồng</strong></p>
      <h2>Chi tiết theo sự kiện, buổi và loại vé</h2>
      <div style={{ overflowX: 'auto' }}><table cellPadding="10" style={{ width: '100%', textAlign: 'left' }}>
        <thead><tr><th>Sự kiện</th><th>Buổi</th><th>Bắt đầu</th><th>Loại vé</th><th>Vé xác nhận</th><th>Giá trị (đồng)</th><th>Lấp đầy</th></tr></thead>
        <tbody>{data.details.map(row => <tr key={`${row.showingId}-${row.ticketTypeId}`}>
          <td>{row.eventTitle} (#{row.eventId})</td><td>{row.showingCode} (#{row.showingId})</td><td>{formatDate(row.startsAt)}</td>
          <td>{row.typeName ? `${row.typeName} (#${row.ticketTypeId})` : 'Chưa có loại vé'}</td>
          <td>{formatNumber(row.confirmedTickets)}</td><td>{formatNumber(row.totalRevenueVnd)}</td>
          <td>{row.capacity ? `${(row.confirmedTickets / row.capacity * 100).toFixed(1)}%` : '—'}</td>
        </tr>)}</tbody>
      </table></div>
      {data.details.length === 0 && <p>Không có dữ liệu trong phạm vi đã chọn.</p>}
      <h2>Buổi chưa có đơn xác nhận ({data.unbookedShowings.length})</h2>
      <p>Phiếu giữ vé và đơn đã hủy không được tính là đơn xác nhận.</p>
      <ul>{data.unbookedShowings.map(row => <li key={row.showingId}>{row.eventTitle} — {row.showingCode} — {row.venueName} — {formatDate(row.startsAt)}</li>)}</ul>
      {data.unbookedShowings.length === 0 && <p>Không có buổi nào đáp ứng điều kiện trong phạm vi đã chọn.</p>}
    </>}
  </section>
}
