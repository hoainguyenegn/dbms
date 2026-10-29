export function fail(message, statusCode = 400, errorCode = 'VALIDATION_ERROR') {
  throw Object.assign(new Error(message), { statusCode, errorCode });
}
export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Dữ liệu phải là một đối tượng.');
  return value;
}
export function fields(value, allowed) {
  object(value);
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('Có trường không được phép thay đổi.');
}
export function text(value, label, max, upper = false) {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max) fail(`${label} phải có từ 1 đến ${max} ký tự.`);
  return upper ? value.trim().toUpperCase() : value.trim();
}
export function code(value, label) {
  const result = text(value, label, 32, true);
  if (!/^[A-Z0-9_-]{3,32}$/.test(result)) fail(`${label} phải có 3–32 ký tự chữ, số, gạch ngang hoặc gạch dưới.`);
  return result;
}
export function integer(value, label, min, max) {
  if (!(typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) fail(`${label} phải là số nguyên từ ${min} đến ${max}.`);
  return Number(value);
}
export const id = value => integer(value, 'ID', 1, 4294967295);
export function date(value, label) {
  // Date-only and local form values are interpreted in Vietnam, explicit offsets are preserved.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) fail(`${label} không đúng định dạng ISO.`);
  if (value.length > 10 && (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || (value[16] === ':' && Number(value.slice(17, 19)) > 59))) fail(`${label} không hợp lệ.`);
  const day = value.slice(0, 10);
  const dayDate = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) fail(`${label} không hợp lệ.`);
  const normalized = value.length === 10 ? `${value}T00:00:00+07:00` : /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+07:00`;
  const result = new Date(normalized);
  if (!Number.isFinite(result.getTime())) fail(`${label} không hợp lệ.`);
  return result;
}
export function eventData(body, patch = false) {
  fields(body, patch ? ['title', 'category', 'description'] : ['event_code', 'title', 'category', 'description', 'showing', 'ticket_types', 'publish_now']);
  const result = {};
  if (!patch) result.event_code = code(body.event_code, 'Mã sự kiện');
  if (!patch || 'title' in body) result.title = text(body.title, 'Tên sự kiện', 200);
  if (!patch || 'category' in body) result.category = text(body.category, 'Thể loại', 50, true);
  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') fail('Mô tả phải là chuỗi.');
    if (body.description && Buffer.byteLength(body.description, 'utf8') > 65535) fail('Mô tả quá dài.');
    result.description = body.description?.trim() || null;
  }
  if (!Object.keys(result).length) fail('Không có dữ liệu cập nhật.');
  return result;
}
export function showingData(body) {
  fields(body, ['showing_code', 'venue_name', 'city_code', 'sales_start_at', 'sales_end_at', 'starts_at', 'ends_at', 'ticket_types']);
  const result = {
    showing_code: code(body.showing_code, 'Mã suất diễn'),
    venue_name: text(body.venue_name, 'Địa điểm', 150),
    city_code: text(body.city_code, 'Mã thành phố', 10, true),
  };
  for (const key of ['sales_start_at', 'sales_end_at', 'starts_at', 'ends_at']) result[key] = date(body[key], key);
  if (!(result.sales_start_at < result.sales_end_at && result.sales_end_at <= result.starts_at && result.starts_at < result.ends_at)) fail('Yêu cầu: Mở bán < Ngừng bán <= Bắt đầu diễn < Kết thúc diễn.', 400, 'INVALID_SCHEDULE');
  return result;
}
export function ticketData(body) {
  fields(body, ['type_name', 'price_vnd', 'capacity']);
  return {
    type_name: text(body.type_name, 'Tên loại vé', 50),
    price_vnd: integer(body.price_vnd, 'Giá vé', 0, 1000000000),
    capacity: integer(body.capacity, 'Số lượng vé', 1, 100000),
  };
}
