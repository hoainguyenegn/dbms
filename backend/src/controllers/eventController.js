import { mysqlPool } from '../config/database.js';
import { fail, id, integer, text, date } from './eventValidation.js';

/**
 * F03: Tìm kiếm danh sách sự kiện công khai
 * GET /api/events
 * Query params: search, category, city, from, to, page, page_size
 */
export async function getPublicEvents(request, response, next) {
  try {
    let {
      search,
      category,
      city,
      from,
      to,
      page = 1,
      page_size = 20,
    } = request.query;

    for (const [key, value] of Object.entries({ search, category, city, from, to })) {
      if (value !== undefined && typeof value !== 'string') fail(`${key} phải là chuỗi.`);
    }
    search = search?.trim(); category = category?.trim(); city = city?.trim();
    if (search) text(search, 'Từ khóa', 200);
    const pageNum = integer(page, 'Trang', 1, 1000000);
    const limit = Math.min(100, integer(page_size, 'Kích thước trang', 1, Number.MAX_SAFE_INTEGER));
    const offset = (pageNum - 1) * limit;
    const fromDate = from ? date(from, 'from') : null;
    const toDate = to ? date(to, 'to') : null;
    if (fromDate && toDate && fromDate >= toDate) fail('from phải nhỏ hơn to.');

    // AC-03.1: Chỉ lấy sự kiện PUBLISHED có ít nhất một buổi chưa bắt đầu (starts_at > NOW())
    // AC-03.2 & AC-03.3: Lọc kết hợp AND. Điều kiện địa phương và thời gian phải cùng thỏa trên ít nhất một buổi.
    const whereConditions = [
      "e.status = 'PUBLISHED'",
      "s.starts_at > UTC_TIMESTAMP(3)",
    ];
    const queryParams = [];

    if (search && search.trim()) {
      whereConditions.push('(e.title LIKE ? OR e.description LIKE ?)');
      const searchParam = `%${search.trim()}%`;
      queryParams.push(searchParam, searchParam);
    }

    if (category && category.trim() && category.trim().toUpperCase() !== 'ALL') {
      whereConditions.push('e.category = ?');
      queryParams.push(category.trim().toUpperCase());
    }

    if (city && city.trim() && city.trim().toUpperCase() !== 'ALL') {
      whereConditions.push('s.city_code = ?');
      queryParams.push(city.trim().toUpperCase());
    }

    if (from && from.trim()) {
      whereConditions.push('s.starts_at >= ?');
      queryParams.push(fromDate);
    }

    if (to && to.trim()) {
      whereConditions.push('s.starts_at < ?');
      queryParams.push(toDate);
    }

    const whereClause = whereConditions.join(' AND ');

    // Đếm tổng số sự kiện thỏa mãn (distinct e.id)
    const countSql = `
      SELECT COUNT(DISTINCT e.id) AS total
      FROM events e
      INNER JOIN event_showings s ON s.event_id = e.id
      WHERE ${whereClause}
    `;

    const [countRows] = await mysqlPool.execute(countSql, queryParams);
    const total = Number(countRows[0]?.total || 0);

    // AC-03.4: Sắp xếp theo thời gian buổi phù hợp sớm nhất, sau đó event_id ASC
    const dataSql = `
      WITH matching AS (
        SELECT e.id, e.event_code, e.title, e.category, e.status, e.description, e.created_at,
          s.starts_at AS earliest_showing_at, s.city_code, s.venue_name,
          CASE WHEN UTC_TIMESTAMP(3) < s.sales_start_at THEN 'UPCOMING'
               WHEN UTC_TIMESTAMP(3) < s.sales_end_at THEN 'OPEN' ELSE 'STOPPED' END AS sales_status,
          (SELECT MIN(t.price_vnd) FROM ticket_types t WHERE t.showing_id = s.id) AS min_price,
          ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY s.starts_at, s.id) AS row_num
        FROM events e INNER JOIN event_showings s ON s.event_id = e.id
        WHERE ${whereClause}
      )
      SELECT id, event_code, title, category, status, description, created_at,
        earliest_showing_at, city_code, venue_name, min_price, sales_status
      FROM matching WHERE row_num = 1
      ORDER BY earliest_showing_at ASC, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [rows] = await mysqlPool.execute(dataSql, queryParams);

    return response.json({
      total,
      page: pageNum,
      page_size: limit,
      total_pages: Math.ceil(total / limit) || 1,
      events: rows,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * F03: Chi tiết sự kiện công khai và tồn vé khả dụng thời gian thực
 * GET /api/events/:id
 */
export async function getPublicEventDetail(request, response, next) {
  try {
    const eventId = id(request.params.id);
    if (!eventId || isNaN(eventId)) {
      return response.status(400).json({
        error: 'INVALID_ID',
        message: 'Mã định danh sự kiện không hợp lệ.',
      });
    }

    // 1. Lấy thông tin sự kiện (chỉ cho phép PUBLISHED theo AC-03.1)
    const [eventRows] = await mysqlPool.execute(
      `SELECT id, event_code, title, category, status, description, created_at, updated_at
       FROM events
       WHERE id = ? AND status = 'PUBLISHED'
       LIMIT 1`,
      [eventId]
    );

    if (eventRows.length === 0) {
      return response.status(404).json({
        error: 'EVENT_NOT_FOUND',
        message: 'Sự kiện không tồn tại hoặc chưa được công bố mở bán.',
      });
    }

    const event = eventRows[0];

    // 2. Lấy danh sách các buổi tổ chức (showings)
    const [showingRows] = await mysqlPool.execute(
      `SELECT id, event_id, showing_code, venue_name, city_code,
              sales_start_at, sales_end_at, starts_at, ends_at
       FROM event_showings
       WHERE event_id = ?
       ORDER BY starts_at ASC`,
      [eventId]
    );

    if (showingRows.length === 0) {
      return response.json({
        event: {
          ...event,
          showings: [],
        },
      });
    }

    const showingIds = showingRows.map((s) => s.id);

    // 3. Lấy các loại vé và tính toán tồn vé khả dụng theo thời gian thực (BR-12, AC-03.6)
    // Tồn khả dụng = capacity - (vé đã bán CONFIRMED) - (vé đang giữ ACTIVE còn hạn)
    const showingPlaceholders = showingIds.map(() => '?').join(',');
    const [ticketTypeRows] = await mysqlPool.execute(
      `SELECT
         tt.id,
         tt.showing_id,
         tt.type_name,
         tt.price_vnd,
         tt.capacity,
         COALESCE(booked.sold_quantity, 0) AS sold_quantity,
         COALESCE(reserved.held_quantity, 0) AS held_quantity,
         GREATEST(0, CAST(tt.capacity AS SIGNED) - COALESCE(booked.sold_quantity, 0) - COALESCE(reserved.held_quantity, 0)) AS available_capacity
       FROM ticket_types tt
       LEFT JOIN (
         SELECT bi.ticket_type_id, SUM(bi.quantity) AS sold_quantity
         FROM booking_items bi
         INNER JOIN bookings b ON b.id = bi.booking_id
         WHERE b.status = 'CONFIRMED'
         GROUP BY bi.ticket_type_id
       ) booked ON booked.ticket_type_id = tt.id
       LEFT JOIN (
         SELECT ri.ticket_type_id, SUM(ri.quantity) AS held_quantity
         FROM reservation_items ri
         INNER JOIN reservations r ON r.id = ri.reservation_id
         WHERE r.status = 'ACTIVE' AND r.expires_at > UTC_TIMESTAMP(3)
         GROUP BY ri.ticket_type_id
       ) reserved ON reserved.ticket_type_id = tt.id
       WHERE tt.showing_id IN (${showingPlaceholders})
       ORDER BY tt.price_vnd ASC`,
      showingIds
    );

    // Ghép ticket types vào từng showing
    const now = new Date();
    const showingsWithTickets = showingRows.map((showing) => {
      const salesStart = new Date(showing.sales_start_at);
      const salesEnd = new Date(showing.sales_end_at);
      const showStart = new Date(showing.starts_at);

      // Xác định trạng thái bán vé (sales_status)
      let salesStatus = 'CLOSED';
      if (now < salesStart) {
        salesStatus = 'UPCOMING'; // Chưa mở bán
      } else if (now >= salesStart && now < salesEnd) {
        salesStatus = 'OPEN';     // Đang mở bán
      } else if (now >= salesEnd && now < showStart) {
        salesStatus = 'STOPPED';  // Ngừng bán
      } else {
        salesStatus = 'ENDED';    // Buổi diễn đã/đang diễn ra
      }

      const tickets = ticketTypeRows.filter((tt) => tt.showing_id === showing.id);
      const totalAvailable = tickets.reduce((sum, t) => sum + Number(t.available_capacity), 0);

      return {
        ...showing,
        sales_status: salesStatus,
        can_reserve: salesStatus === 'OPEN' && totalAvailable > 0,
        ticket_types: tickets.map((t) => ({
          id: t.id,
          type_name: t.type_name,
          price_vnd: Number(t.price_vnd),
          capacity: Number(t.capacity),
          sold_quantity: Number(t.sold_quantity),
          held_quantity: Number(t.held_quantity),
          available_capacity: Number(t.available_capacity),
        })),
      };
    });

    return response.json({
      event: {
        ...event,
        showings: showingsWithTickets,
      },
    });
  } catch (error) {
    return next(error);
  }
}
