function invalidFilter(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function parseStatsFilters(query = {}) {
  const filters = {};
  for (const key of ['eventId', 'showingId', 'ticketTypeId']) {
    if (query[key] === undefined || query[key] === '') continue;
    if (typeof query[key] !== 'string' || !/^[1-9]\d*$/.test(query[key]) || !Number.isSafeInteger(Number(query[key]))) {
      throw invalidFilter(`${key} phải là số nguyên dương.`);
    }
    filters[key] = Number(query[key]);
  }
  for (const key of ['from', 'to']) {
    const value = query[key];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalidFilter('Ngày phải có định dạng YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalidFilter('Ngày không hợp lệ.');
    filters[key] = value;
  }
  if (filters.from && filters.to && filters.from > filters.to) throw invalidFilter('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  return filters;
}

export async function getAdminStats(pool, query = {}) {
  const filters = parseStatsFilters(query);
  const conditions = [];
  const params = [];
  for (const [key, column] of [['eventId', 'e.id'], ['showingId', 's.id'], ['ticketTypeId', 'tt.id']]) {
    if (filters[key]) { conditions.push(`${column} = ?`); params.push(filters[key]); }
  }
  for (const [key, operator, extraDay] of [['from', '>=', 0], ['to', '<', 86400000]]) {
    if (filters[key]) {
      conditions.push(`s.starts_at ${operator} ?`);
      params.push(new Date(new Date(`${filters[key]}T00:00:00+07:00`).getTime() + extraDay));
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const connection = await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();
    const [rows] = await connection.query(`
      SELECT e.id AS event_id, e.title AS event_title, s.id AS showing_id,
             s.showing_code, s.venue_name,
             DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.000Z') AS starts_at,
             tt.id AS ticket_type_id, tt.type_name, tt.capacity,
             COALESCE(sales.quantity, 0) AS confirmed_tickets,
             COALESCE(sales.revenue, 0) AS revenue_vnd
      FROM events e
      JOIN event_showings s ON s.event_id = e.id
      LEFT JOIN ticket_types tt ON tt.showing_id = s.id
      LEFT JOIN (
        SELECT bi.ticket_type_id, SUM(bi.quantity) AS quantity,
               SUM(bi.subtotal_vnd) AS revenue
        FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
        WHERE b.status = 'CONFIRMED'
        GROUP BY bi.ticket_type_id
      ) sales ON sales.ticket_type_id = tt.id
      ${where}
      ORDER BY e.id, s.starts_at, s.id, tt.id`, params);
    const [unbooked] = await connection.query(`
      SELECT DISTINCT s.id AS showing_id, s.showing_code, e.title AS event_title,
             s.venue_name, DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i:%s.000Z') AS starts_at
      FROM event_showings s JOIN events e ON e.id = s.event_id
      LEFT JOIN ticket_types tt ON tt.showing_id = s.id
      ${where || 'WHERE 1 = 1'}
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.showing_id = s.id AND b.status = 'CONFIRMED')
      ORDER BY starts_at, showing_id`, params);
    await connection.commit();
    const details = rows.map(row => ({
      eventId: Number(row.event_id), eventTitle: row.event_title,
      showingId: Number(row.showing_id), showingCode: row.showing_code,
      venueName: row.venue_name, startsAt: row.starts_at,
      ticketTypeId: row.ticket_type_id === null ? null : Number(row.ticket_type_id),
      typeName: row.type_name, capacity: Number(row.capacity || 0),
      confirmedTickets: Number(row.confirmed_tickets), totalRevenueVnd: Number(row.revenue_vnd),
    }));
    return { source: 'mysql_database', data: {
      confirmedTickets: details.reduce((sum, row) => sum + row.confirmedTickets, 0),
      totalRevenueVnd: details.reduce((sum, row) => sum + row.totalRevenueVnd, 0),
      details,
      unbookedShowings: unbooked.map(row => ({
        showingId: Number(row.showing_id), showingCode: row.showing_code,
        eventTitle: row.event_title, venueName: row.venue_name, startsAt: row.starts_at,
      })),
    } };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
