import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export default function StatsPage() {
  const { token, user, loading: authLoading, openAuthModal } = useAuth();
  const [data, setData] = useState(null);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboardStats = useCallback(async () => {
    if (!token) {
      setError('Vui lòng đăng nhập để tiếp tục.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setData(result.stats);
        setSource(result.source);
      } else {
        setError(result.message || 'Không thể tải dữ liệu thống kê');
      }
    } catch (err) {
      setError('Lỗi kết nối Server Backend: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  if (authLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Đang kiểm tra tài khoản...</div>;
  }

  if (!user || user.role !== 'MANAGER') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 480, margin: '60px auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <h2>Truy cập bị từ chối</h2>
        <p style={{ color: '#64748b', margin: '16px 0 24px' }}>
          Khu vực này chỉ dành riêng cho tài khoản Quản lý (MANAGER).
        </p>
        <button type="button" className="btn-primary" onClick={() => openAuthModal('login')}>
          Đăng nhập lại
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '30px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>F07 - Báo Cáo Thống Kê Hệ Thống (Dashboard)</h2>
        <button
          onClick={fetchDashboardStats}
          disabled={loading}
          style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}
        >
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {source && (
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
          Nguồn dữ liệu: <strong>{source === 'redis_cache' ? 'Redis 7.0 Cache' : 'MySQL 8.0 Database'}</strong>
        </p>
      )}

      {error && <p style={{ color: '#dc2626', marginTop: '12px', fontWeight: '600' }}>{error}</p>}

      {data && (
        <div style={{ marginTop: '24px' }}>
          {/* CARDS TỔNG QUAN */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
            <div style={{ flex: 1, padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <h4 style={{ margin: 0, color: '#475569', fontSize: '14px' }}>Tổng Vé Đã Xác Nhận</h4>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0 0 0', color: '#16a34a' }}>
                {data.confirmedTickets.toLocaleString()} vé
              </p>
            </div>
            <div style={{ flex: 1, padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <h4 style={{ margin: 0, color: '#475569', fontSize: '14px' }}>Tổng Doanh Thu Đơn Hàng</h4>
              <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0 0 0', color: '#2563eb' }}>
                {data.totalRevenueVnd.toLocaleString()} VNĐ
              </p>
            </div>
          </div>

          {/* BẢNG CÁC BUỔI CHƯA CÓ ĐƠN */}
          <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '12px' }}>
            Các Buổi Chưa Có Đơn Xác Nhận ({data.unbookedShowings.length})
          </h3>
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', borderColor: '#e2e8f0' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                <th>Mã Suất</th>
                <th>Tên Sự Kiện</th>
                <th>Địa Điểm</th>
                <th>Thời Gian Bắt Đầu</th>
              </tr>
            </thead>
            <tbody>
              {data.unbookedShowings.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b' }}>Tất cả các buổi tổ chức đều đã có đơn đặt vé!</td>
                </tr>
              ) : (
                data.unbookedShowings.map((item) => (
                  <tr key={item.showingId}>
                    <td><code>{item.showingCode}</code></td>
                    <td><strong>{item.eventTitle}</strong></td>
                    <td>{item.venueName}</td>
                    <td>{item.startsAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}