import { BookingError } from './bookingPolicy.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeReservationInput(input) {
  const showingId = Number(input?.showing_id);
  const requestKey = typeof input?.request_key === 'string' ? input.request_key.trim().toLowerCase() : '';
  const items = input?.items;

  if (!Number.isSafeInteger(showingId) || showingId < 1) {
    throw new BookingError(400, 'INVALID_SHOWING_ID', 'Mã suất diễn không hợp lệ.');
  }
  if (!uuidPattern.test(requestKey)) {
    throw new BookingError(400, 'INVALID_REQUEST_KEY', 'request_key phải là UUID hợp lệ.');
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 6) {
    throw new BookingError(400, 'INVALID_RESERVATION_ITEMS', 'Phiếu giữ cần từ 1 đến 6 dòng vé.');
  }

  const normalizedItems = items.map((item) => {
    const ticketTypeId = Number(item?.ticket_type_id);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(ticketTypeId) || ticketTypeId < 1) {
      throw new BookingError(400, 'INVALID_TICKET_TYPE_ID', 'Mã loại vé không hợp lệ.');
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 6) {
      throw new BookingError(400, 'INVALID_TICKET_QUANTITY', 'Số lượng mỗi loại vé phải từ 1 đến 6.');
    }
    return { ticketTypeId, quantity };
  }).sort((left, right) => left.ticketTypeId - right.ticketTypeId);

  if (normalizedItems.some((item, index) => index > 0 && item.ticketTypeId === normalizedItems[index - 1].ticketTypeId)) {
    throw new BookingError(400, 'DUPLICATE_TICKET_TYPE', 'Mỗi loại vé chỉ được xuất hiện một lần.');
  }
  const totalQuantity = normalizedItems.reduce((total, item) => total + item.quantity, 0);
  if (totalQuantity > 6) {
    throw new BookingError(400, 'RESERVATION_LIMIT_EXCEEDED', 'Mỗi phiếu giữ tối đa 6 vé.');
  }

  return { showingId, requestKey, items: normalizedItems, totalQuantity };
}

export function sameReservationPayload(existingItems, requestedItems) {
  const sortItems = (items) => items
    .map((item) => ({
      ticketTypeId: Number(item.ticket_type_id ?? item.ticketTypeId),
      quantity: Number(item.quantity),
    }))
    .sort((left, right) => left.ticketTypeId - right.ticketTypeId);
  const existing = sortItems(existingItems);
  const requested = sortItems(requestedItems);
  return existing.length === requestedItems.length
    && existing.every((item, index) => (
      item.ticketTypeId === requested[index].ticketTypeId
      && item.quantity === requested[index].quantity
    ));
}

export function calculateReservationExpiry(now, salesEnd) {
  return new Date(Math.min(new Date(now).getTime() + 300000, new Date(salesEnd).getTime()));
}