import app from './app.js';
import { mysqlPool, redisClient } from './config/database.js';

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`API: http://localhost:${server.address().port}`);
});

server.on('error', (error) => {
  console.error('Cannot start API:', error.message);
  process.exit(1);
});

// API vẫn phản hồi /health khi Redis chưa sẵn sàng; client tự thử kết nối lại.
redisClient.connect().catch((error) => {
  console.error('Cannot connect to Redis:', error.message);
});

let stopping = false;

function shutdown() {
  if (stopping) return;
  stopping = true;

  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();

  server.close(async () => {
    try {
      if (redisClient.isOpen) redisClient.destroy();
      await mysqlPool.end();
      clearTimeout(timer);
      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed:', error.message);
      process.exit(1);
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
