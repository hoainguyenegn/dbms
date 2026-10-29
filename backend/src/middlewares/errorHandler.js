/**
 * Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng Express
 */
export function errorHandler(error, _request, response, _next) {
  // Ghi log lỗi để phục vụ debug phát triển
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Error Handler]:', error);
  }

  // 1. Xử lý lỗi MySQL trùng lặp khóa (Unique Key Violation - 409)
  if (error.code === 'ER_DUP_ENTRY') {
    return response.status(409).json({
      error: 'DUPLICATE_ENTRY',
      message: 'Dữ liệu đã tồn tại trong hệ thống (trùng tên đăng nhập, email hoặc mã nghiệp vụ).',
    });
  }

  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    return response.status(409).json({ error: 'HAS_DEPENDENCIES', message: 'Không thể xóa danh mục đã có phiếu giữ, đơn hoặc vé phụ thuộc.' });
  }

  // 2. Xử lý lỗi khóa ngoại MySQL (Foreign Key Constraint Fail - 400)
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return response.status(400).json({
      error: 'INVALID_REFERENCE',
      message: 'Đối tượng tham chiếu không tồn tại trong cơ sở dữ liệu.',
    });
  }

  // 3. Xử lý lỗi vi phạm ràng buộc CHECK trong MySQL 8.0 (400)
  if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return response.status(400).json({
      error: 'CHECK_CONSTRAINT_VIOLATED',
      message: 'Dữ liệu không đáp ứng các ràng buộc kiểm tra hợp lệ của hệ thống.',
    });
  }

  // 4. Xử lý lỗi JWT (Token không hợp lệ hoặc hết hạn - 401)
  if (error.name === 'JsonWebTokenError') {
    return response.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Mã xác thực phiên làm việc không hợp lệ.',
    });
  }
  if (error.name === 'TokenExpiredError') {
    return response.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }

  // 5. Lỗi nghiệp vụ có gán statusCode cụ thể
  const statusCode = error.statusCode || error.status || 500;
  const errorCode = error.errorCode || error.code || 'INTERNAL_SERVER_ERROR';
  const message = error.message || 'Đã xảy ra lỗi hệ thống nội bộ.';

  return response.status(statusCode).json({
    error: errorCode,
    message,
  });
}

