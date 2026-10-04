export class BookingError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function assertReservationCanBeConfirmed(reservation, now) {
  if (!reservation) {
    throw new BookingError(404, 'RESERVATION_NOT_FOUND', 'Không tìm thấy phiếu giữ vé.');
  }

  if (reservation.status !== 'ACTIVE') {
    throw new BookingError(409, 'RESERVATION_NOT_ACTIVE', 'Phiếu giữ vé không còn hiệu lực.');
  }

  const currentTime = new Date(now).getTime();
  if (new Date(reservation.expires_at).getTime() <= currentTime) {
    throw new BookingError(409, 'RESERVATION_EXPIRED', 'Phiếu giữ vé đã hết hạn.');
  }

  if (reservation.event_status !== 'PUBLISHED') {
    throw new BookingError(409, 'EVENT_NOT_ON_SALE', 'Sự kiện không còn mở bán.');
  }

  if (
    new Date(reservation.sales_start_at).getTime() > currentTime
    || new Date(reservation.sales_end_at).getTime() <= currentTime
  ) {
    throw new BookingError(409, 'SHOWING_NOT_ON_SALE', 'Suất diễn hiện không trong thời gian bán vé.');
  }
}

export function canCancelBooking(booking, now) {
  if (booking.status === 'CANCELLED') return false;

  if (booking.status !== 'CONFIRMED') {
    throw new BookingError(409, 'BOOKING_NOT_CANCELLABLE', 'Đơn hàng hiện không thể hủy.');
  }

  if (new Date(booking.starts_at).getTime() <= new Date(now).getTime()) {
    throw new BookingError(409, 'CANCELLATION_CLOSED', 'Không thể hủy đơn tại hoặc sau giờ bắt đầu suất diễn.');
  }

  return true;
}