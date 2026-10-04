export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error('API request failed:', error.message);
  response.status(status).json({
    error: error.code || 'INTERNAL_ERROR',
    message: status >= 500 ? 'Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại.' : error.message,
  });
}