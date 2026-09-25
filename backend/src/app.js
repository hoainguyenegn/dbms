import cors from 'cors';
import express from 'express';
import { mysqlPool, redisClient } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Endpoint kiểm tra hệ thống
app.get('/', (_request, response) => {
  response.json({ name: 'EventBox API — Đồ án môn Cơ sở dữ liệu (DBMS)', version: '1.1.0' });
});

app.get('/health/live', (_request, response) => {
  response.json({ status: 'up' });
});

app.get('/health', async (_request, response) => {
  const [mysqlResult, redisResult] = await Promise.allSettled([
    mysqlPool.query({ sql: 'SELECT 1', timeout: 2000 }),
    redisClient.withCommandOptions({ timeout: 2000 }).ping(),
  ]);

  const services = {
    api: 'up',
    mysql: mysqlResult.status === 'fulfilled' ? 'up' : 'down',
    redis: redisResult.status === 'fulfilled' ? 'up' : 'down',
  };
  const healthy = services.mysql === 'up' && services.redis === 'up';

  response.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    services,
  });
});

// Các nhóm Router nghiệp vụ (API Skeleton hoàn chỉnh)
app.use('/api/auth', authRoutes);       // Xác thực, đăng nhập, đăng xuất, lấy thông tin phiên
app.use('/api/admin', adminRoutes);     // F01, F02, F07: Quản lý sự kiện, buổi, loại vé, báo cáo (MANAGER)
app.use('/api', publicRoutes);          // F03: Tìm kiếm và xem sự kiện công khai
app.use('/api', bookingRoutes);         // F04, F05, F06, F08: Giữ vé, đặt vé, lịch sử đơn và email vé

// Bắt các route không tồn tại (404)
app.use((_request, response) => {
  response.status(404).json({ error: 'ROUTE_NOT_FOUND', message: 'Đường dẫn API không tồn tại.' });
});

// Middleware xử lý lỗi tập trung
app.use(errorHandler);

export default app;

