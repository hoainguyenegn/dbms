import { mysqlPool } from '../config/database.js';
import { cancelBooking, confirmReservation, getBooking, listBookings } from '../services/bookingService.js';

const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response)).catch(next);
};

export const confirm = asyncRoute(async (request, response) => {
  const reservationId = request.params.reservationId || request.body?.reservation_id;
  if (typeof reservationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reservationId)) {
    return response.status(400).json({ error: 'INVALID_RESERVATION_ID', message: 'Mã phiếu giữ vé không hợp lệ.' });
  }
  const result = await confirmReservation(mysqlPool, reservationId, request.user.id);
  return response.status(result.created ? 201 : 200).json({ booking: result.booking });
});

export const history = asyncRoute(async (request, response) => {
  const page = Number(request.query.page ?? 1);
  const pageSize = Number(request.query.page_size ?? 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return response.status(400).json({ error: 'INVALID_PAGINATION', message: 'Phân trang không hợp lệ.' });
  }
  return response.json(await listBookings(mysqlPool, request.user.id, page, pageSize));
});

export const detail = asyncRoute(async (request, response) => {
  return response.json({ booking: await getBooking(mysqlPool, request.params.bookingCode, request.user.id) });
});

export const cancel = asyncRoute(async (request, response) => {
  return response.json({ booking: await cancelBooking(mysqlPool, request.params.bookingCode, request.user.id) });
});