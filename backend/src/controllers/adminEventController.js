import { mysqlPool } from '../config/database.js';
import { fail, id, fields, text, eventData, showingData, ticketData } from './eventValidation.js';

// All catalog writes lock the parent event first, including publication.
// This serializes publication with changes to its showings and ticket types.
async function transaction(work) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
const handler = work => async (req, res, next) => {
  try { await work(req, res); } catch (error) { next(error); }
};
async function lockEvent(db, eventId, expected = 'DRAFT') {
  const [[event]] = await db.execute('SELECT * FROM events WHERE id = ? FOR UPDATE', [eventId]);
  if (!event) fail('Sự kiện không tồn tại.', 404, 'EVENT_NOT_FOUND');
  if (event.status !== expected) fail(`Thao tác chỉ áp dụng khi sự kiện ${expected}.`, 409, 'INVALID_STATUS_TRANSITION');
  return event;
}
async function child(db, table, childId, scope = {}) {
  const sql = table === 'event_showings'
    ? 'SELECT event_id FROM event_showings WHERE id = ?'
    : 'SELECT s.event_id FROM ticket_types t JOIN event_showings s ON s.id = t.showing_id WHERE t.id = ?';
  const [[parent]] = await db.execute(sql, [childId]);
  if (!parent) fail('Suất diễn hoặc loại vé không tồn tại.', 404, 'CATALOG_NOT_FOUND');
  await lockEvent(db, parent.event_id);
  // Re-read after obtaining the event lock; a concurrent deletion may have committed.
  const [[row]] = await db.execute(`SELECT * FROM ${table} WHERE id = ? FOR UPDATE`, [childId]);
  if (!row) fail('Suất diễn hoặc loại vé không tồn tại.', 404, 'CATALOG_NOT_FOUND');
  if (scope.eventId !== undefined && row.event_id !== id(scope.eventId) || scope.showingId !== undefined && row.showing_id !== id(scope.showingId)) fail('Danh mục không thuộc đối tượng trên URL.', 404, 'CATALOG_NOT_FOUND');
  return row;
}
async function insert(db, table, values) {
  const keys = Object.keys(values);
  const [result] = await db.execute(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, Object.values(values));
  return { id: result.insertId, ...values };
}
async function update(db, table, rowId, values) {
  await db.execute(`UPDATE ${table} SET ${Object.keys(values).map(key => `${key} = ?`).join(', ')} WHERE id = ?`, [...Object.values(values), rowId]);
}
async function publish(db, eventId) {
  const [showings] = await db.execute(`SELECT s.*, UTC_TIMESTAMP(3) AS server_now,
    (SELECT COUNT(*) FROM ticket_types t WHERE t.showing_id = s.id) AS ticket_count
    FROM event_showings s WHERE s.event_id = ?`, [eventId]);
  if (!showings.length) fail('Cần có ít nhất một suất diễn.', 400, 'NO_SHOWINGS');
  for (const showing of showings) {
    if (!(showing.sales_start_at < showing.sales_end_at && showing.sales_end_at <= showing.starts_at && showing.starts_at < showing.ends_at && showing.sales_end_at > showing.server_now)) fail('Mọi suất diễn phải có lịch hợp lệ và thời điểm ngừng bán ở tương lai.', 400, 'INVALID_SALES_SCHEDULE');
    if (!Number(showing.ticket_count)) fail('Mỗi suất diễn phải có ít nhất một loại vé.', 400, 'NO_TICKET_TYPES');
  }
  await db.execute("UPDATE events SET status = 'PUBLISHED' WHERE id = ?", [eventId]);
}

export const getAdminEvents = handler(async (req, res) => {
  const conditions = [], params = [];
  for (const key of ['status', 'category', 'search']) {
    if (req.query[key] === undefined || req.query[key] === '') continue;
    const value = text(req.query[key], key, key === 'search' ? 200 : 50, key !== 'search');
    if (key === 'status' && !['DRAFT', 'PUBLISHED', 'CLOSED'].includes(value)) fail('Trạng thái không hợp lệ.');
    if (key === 'search') { conditions.push('(e.title LIKE ? OR e.event_code LIKE ?)'); params.push(`%${value}%`, `%${value}%`); }
    else { conditions.push(`e.${key} = ?`); params.push(value); }
  }
  const [events] = await mysqlPool.execute(`SELECT e.*,
    (SELECT COUNT(*) FROM event_showings s WHERE s.event_id = e.id) AS showings_count,
    (SELECT COUNT(*) FROM ticket_types t JOIN event_showings s ON s.id = t.showing_id WHERE s.event_id = e.id) AS ticket_types_count,
    COALESCE((SELECT SUM(t.capacity) FROM ticket_types t JOIN event_showings s ON s.id = t.showing_id WHERE s.event_id = e.id), 0) AS total_capacity,
    COALESCE((SELECT SUM(bi.quantity) FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id JOIN event_showings s ON s.id = b.showing_id WHERE s.event_id = e.id AND b.status = 'CONFIRMED'), 0) AS total_sold_tickets
    FROM events e ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY e.created_at DESC, e.id DESC`, params);
  for (const event of events) for (const key of ['showings_count', 'ticket_types_count', 'total_capacity', 'total_sold_tickets']) event[key] = Number(event[key]);
  res.json({ total: events.length, events });
});
export const getAdminEventDetail = handler(async (req, res) => {
  const eventId = id(req.params.id);
  const [[event]] = await mysqlPool.execute('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event) fail('Sự kiện không tồn tại.', 404, 'EVENT_NOT_FOUND');
  const [showings] = await mysqlPool.execute('SELECT * FROM event_showings WHERE event_id = ? ORDER BY starts_at, id', [eventId]);
  const [tickets] = await mysqlPool.execute('SELECT t.* FROM ticket_types t JOIN event_showings s ON s.id = t.showing_id WHERE s.event_id = ? ORDER BY t.price_vnd, t.id', [eventId]);
  event.showings = showings.map(s => ({ ...s, ticket_types: tickets.filter(t => t.showing_id === s.id) }));
  res.json({ event });
});
export const createEvent = handler(async (req, res) => {
  const values = eventData(req.body);
  if (req.body.publish_now !== undefined && typeof req.body.publish_now !== 'boolean') fail('publish_now phải là boolean.');
  let showing, tickets = [];
  if (req.body.showing !== undefined) {
    showing = showingData(req.body.showing);
    const input = req.body.ticket_types ?? req.body.showing.ticket_types ?? [];
    if (!Array.isArray(input)) fail('Danh sách loại vé không hợp lệ.');
    tickets = input.map(ticketData);
  } else if (req.body.ticket_types !== undefined) fail('Loại vé cần thuộc một suất diễn.');
  const event = await transaction(async db => {
    const event = await insert(db, 'events', values);
    if (showing) {
      const saved = await insert(db, 'event_showings', { event_id: event.id, ...showing });
      for (const ticket of tickets) await insert(db, 'ticket_types', { showing_id: saved.id, ...ticket });
    }
    if (req.body.publish_now) await publish(db, event.id);
    return { ...event, status: req.body.publish_now ? 'PUBLISHED' : 'DRAFT' };
  });
  res.status(201).json({ message: 'Tạo sự kiện thành công.', event });
});
export const updateEvent = handler(async (req, res) => {
  const eventId = id(req.params.id), values = eventData(req.body, true);
  await transaction(async db => { await lockEvent(db, eventId); await update(db, 'events', eventId, values); });
  res.json({ message: 'Cập nhật sự kiện thành công.' });
});
export const publishEvent = handler(async (req, res) => {
  const eventId = id(req.params.id);
  await transaction(async db => { await lockEvent(db, eventId); await publish(db, eventId); });
  res.json({ message: 'Công bố sự kiện thành công.', status: 'PUBLISHED' });
});
export const closeEvent = handler(async (req, res) => {
  const eventId = id(req.params.id);
  const count = await transaction(async db => {
    await lockEvent(db, eventId, 'PUBLISHED');
    await db.execute("UPDATE events SET status = 'CLOSED' WHERE id = ?", [eventId]);
    const [result] = await db.execute("UPDATE reservations r JOIN event_showings s ON s.id = r.showing_id SET r.status = 'RELEASED' WHERE s.event_id = ? AND r.status = 'ACTIVE'", [eventId]);
    return result.affectedRows;
  });
  res.json({ message: 'Đã đóng sự kiện và giải phóng phiếu giữ.', status: 'CLOSED', released_reservations_count: count });
});
export const deleteEvent = handler(async (req, res) => {
  const eventId = id(req.params.id);
  await transaction(async db => {
    await lockEvent(db, eventId);
    await db.execute('DELETE t FROM ticket_types t JOIN event_showings s ON s.id = t.showing_id WHERE s.event_id = ?', [eventId]);
    await db.execute('DELETE FROM event_showings WHERE event_id = ?', [eventId]);
    await db.execute('DELETE FROM events WHERE id = ?', [eventId]);
  });
  res.json({ message: 'Đã xóa sự kiện nháp và danh mục con.' });
});
export const createShowing = handler(async (req, res) => {
  const eventId = id(req.params.id), values = showingData(req.body);
  if ('ticket_types' in req.body) fail('Hãy tạo loại vé qua API loại vé.');
  const showing = await transaction(async db => { await lockEvent(db, eventId); return insert(db, 'event_showings', { event_id: eventId, ...values }); });
  res.status(201).json({ message: 'Thêm suất diễn thành công.', showing });
});
export const updateShowing = handler(async (req, res) => {
  const showingId = id(req.params.id);
  fields(req.body, ['venue_name', 'city_code', 'sales_start_at', 'sales_end_at', 'starts_at', 'ends_at']);
  if (!Object.keys(req.body).length) fail('Không có dữ liệu cập nhật.');
  await transaction(async db => {
    const row = await child(db, 'event_showings', showingId, req.params);
    const base = { showing_code: row.showing_code, venue_name: row.venue_name, city_code: row.city_code };
    for (const key of ['sales_start_at', 'sales_end_at', 'starts_at', 'ends_at']) base[key] = row[key].toISOString();
    const values = showingData({ ...base, ...req.body });
    delete values.showing_code;
    await update(db, 'event_showings', showingId, values);
  });
  res.json({ message: 'Cập nhật suất diễn thành công.' });
});
export const deleteShowing = handler(async (req, res) => {
  const showingId = id(req.params.id);
  await transaction(async db => {
    await child(db, 'event_showings', showingId, req.params);
    // FK RESTRICT rejects historical dependencies; the transaction rolls back child deletions.
    await db.execute('DELETE FROM ticket_types WHERE showing_id = ?', [showingId]);
    await db.execute('DELETE FROM event_showings WHERE id = ?', [showingId]);
  });
  res.json({ message: 'Đã xóa suất diễn và loại vé.' });
});
export const createTicketType = handler(async (req, res) => {
  const showingId = id(req.params.id), values = ticketData(req.body);
  const ticket = await transaction(async db => { await child(db, 'event_showings', showingId, req.params); return insert(db, 'ticket_types', { showing_id: showingId, ...values }); });
  res.status(201).json({ message: 'Thêm loại vé thành công.', ticket_type: ticket });
});
export const updateTicketType = handler(async (req, res) => {
  const ticketId = id(req.params.id);
  fields(req.body, ['type_name', 'price_vnd', 'capacity']);
  if (!Object.keys(req.body).length) fail('Không có dữ liệu cập nhật.');
  await transaction(async db => {
    const row = await child(db, 'ticket_types', ticketId, req.params);
    await update(db, 'ticket_types', ticketId, ticketData({ type_name: row.type_name, price_vnd: row.price_vnd, capacity: row.capacity, ...req.body }));
  });
  res.json({ message: 'Cập nhật loại vé thành công.' });
});
export const deleteTicketType = handler(async (req, res) => {
  const ticketId = id(req.params.id);
  await transaction(async db => { await child(db, 'ticket_types', ticketId, req.params); await db.execute('DELETE FROM ticket_types WHERE id = ?', [ticketId]); });
  res.json({ message: 'Đã xóa loại vé.' });
});
