import { mysqlPool, redisClient } from '../config/database.js';
import {
  createReservation,
  getReservation,
  listOnSaleShowings,
  releaseReservation,
} from '../services/reservationService.js';

const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response)).catch(next);
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const onSaleShowings = asyncRoute(async (_request, response) => {
  return response.json({ items: await listOnSaleShowings(mysqlPool) });
});

export const create = asyncRoute(async (request, response) => {
  const allowedFields = new Set(['request_key', 'showing_id', 'items']);
  if (!request.body || Object.keys(request.body).some((key) => !allowedFields.has(key))) {
    return response.status(400).json({ error: 'UNSUPPORTED_FIELD', message: 'Yêu cầu chứa trường không được hỗ trợ.' });
  }
  if (Array.isArray(request.body.items) && request.body.items.some((item) => (
    !item || Object.keys(item).some((key) => !['ticket_type_id', 'quantity'].includes(key))
  ))) {
    return response.status(400).json({ error: 'UNSUPPORTED_FIELD', message: 'Chi tiết vé chứa trường không được hỗ trợ.' });
  }

  const result = await createReservation(mysqlPool, redisClient, request.body, request.user.id);
  return response.status(result.created ? 201 : 200).json({
    reservation: result.reservation,
    redisCached: result.redisCached ?? false,
  });
});

export const detail = asyncRoute(async (request, response) => {
  if (!uuidPattern.test(request.params.reservationId)) {
    return response.status(400).json({ error: 'INVALID_RESERVATION_ID', message: 'Mã phiếu giữ vé không hợp lệ.' });
  }
  return response.json({
    reservation: await getReservation(mysqlPool, request.params.reservationId, request.user.id),
  });
});

export const release = asyncRoute(async (request, response) => {
  if (!uuidPattern.test(request.params.reservationId)) {
    return response.status(400).json({ error: 'INVALID_RESERVATION_ID', message: 'Mã phiếu giữ vé không hợp lệ.' });
  }
  return response.json({
    reservation: await releaseReservation(
      mysqlPool,
      redisClient,
      request.params.reservationId,
      request.user.id,
    ),
  });
});