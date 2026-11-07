import { mysqlPool, redisClient } from '../config/database.js';

export async function getAdminStats(pool) {
  const cacheKey = 'eventbox:stats:dashboard';

  // 1. Xóa cache Redis cũ để luôn quét trực tiếp MySQL
  if (redisClient?.isReady) {
    try {
      await redisClient.del(cacheKey);
    } catch (err) {
      console.warn('Xóa Redis cache cũ thất bại:', err.message);
    }
  }

  let confirmedTickets = 0;
  let totalRevenueVnd = 0;

  // 2. Query 1: Lấy từ bảng bookings (thử cả cột total_amount_vnd và total_amount)
  try {
    const [salesRows] = await pool.query(`
      SELECT 
        COALESCE(SUM(bi.quantity), 0) AS total_confirmed_tickets,
        COALESCE(SUM(
          CASE 
            WHEN b.total_amount_vnd IS NOT NULL THEN b.total_amount_vnd 
            ELSE b.total_amount 
          END
        ), 0) AS total_revenue_vnd
      FROM bookings b
      JOIN booking_items bi ON bi.booking_id = b.id
      WHERE LOWER(b.status) IN ('confirmed', 'success', 'paid', 'completed', 'active')
    `);

    if (salesRows && salesRows[0]) {
      confirmedTickets = Number(salesRows[0].total_confirmed_tickets || 0);
      totalRevenueVnd = Number(salesRows[0].total_revenue_vnd || 0);
    }
  } catch (err) {
    // Nếu bảng bookings bị lỗi tên cột, quét từ booking_items kết hợp ticket_types
    try {
      const [salesAlt] = await pool.query(`
        SELECT 
          COALESCE(SUM(bi.quantity), 0) AS total_confirmed_tickets,
          COALESCE(SUM(bi.quantity * tt.price_vnd), 0) AS total_revenue_vnd
        FROM bookings b
        JOIN booking_items bi ON bi.booking_id = b.id
        JOIN ticket_types tt ON tt.id = bi.ticket_type_id
        WHERE LOWER(b.status) IN ('confirmed', 'success', 'paid', 'completed', 'active')
      `);
      if (salesAlt && salesAlt[0]) {
        confirmedTickets = Number(salesAlt[0].total_confirmed_tickets || 0);
        totalRevenueVnd = Number(salesAlt[0].total_revenue_vnd || 0);
      }
    } catch (innerErr) {
      console.warn('Lỗi query bookings:', innerErr.message);
    }
  }

  // 3. Fallback: Nếu bookings chưa có dữ liệu, lấy từ bảng reservations đã chốt
  if (confirmedTickets === 0) {
    try {
      const [resRows] = await pool.query(`
        SELECT 
          COALESCE(SUM(ri.quantity), 0) AS total_tickets,
          COALESCE(SUM(ri.quantity * tt.price_vnd), 0) AS total_revenue
        FROM reservations r
        JOIN reservation_items ri ON ri.reservation_id = r.id
        JOIN ticket_types tt ON tt.id = ri.ticket_type_id
        WHERE LOWER(r.status) IN ('active', 'confirmed', 'consumed')
      `);

      if (resRows && resRows[0]) {
        confirmedTickets = Number(resRows[0].total_tickets || 0);
        totalRevenueVnd = Number(resRows[0].total_revenue || 0);
      }
    } catch (fallbackErr) {
      console.warn('Lỗi query reservations:', fallbackErr.message);
    }
  }

  // 4. Query danh sách suất diễn chưa từng có đơn
  let unbookedShowings = [];
  try {
    const [showingRows] = await pool.query(`
      SELECT 
        s.id AS showing_id,
        s.showing_code,
        e.title AS event_title,
        s.venue_name,
        DATE_FORMAT(s.starts_at, '%Y-%m-%d %H:%i') AS starts_at
      FROM event_showings s
      JOIN events e ON e.id = s.event_id
      WHERE s.id NOT IN (
        SELECT DISTINCT bi.showing_id 
        FROM booking_items bi
        JOIN bookings b ON b.id = bi.booking_id
        WHERE LOWER(b.status) IN ('confirmed', 'success', 'paid', 'completed', 'active')
      )
      AND s.id NOT IN (
        SELECT DISTINCT ri.showing_id 
        FROM reservation_items ri
        JOIN reservations r ON r.id = ri.reservation_id
        WHERE LOWER(r.status) IN ('active', 'confirmed', 'consumed')
      )
      ORDER BY s.starts_at ASC
    `);

    unbookedShowings = (showingRows || []).map(row => ({
      showingId: Number(row.showing_id),
      showingCode: row.showing_code || '',
      eventTitle: row.event_title || '',
      venueName: row.venue_name || '',
      startsAt: row.starts_at || ''
    }));
  } catch (err) {
    console.warn('Lỗi query unbooked:', err.message);
  }

  const resultData = {
    confirmedTickets,
    totalRevenueVnd,
    unbookedShowings
  };

  // 5. Cache ngắn hạn vào Redis (2 giây)
  if (redisClient?.isReady) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(resultData), { EX: 2 });
    } catch (err) {
      console.warn('Redis write warning:', err.message);
    }
  }

  return { source: 'mysql_database', data: resultData };
}