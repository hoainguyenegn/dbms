import app from './app.js';
import { createServer } from 'node:http';
import { mysqlPool, redisClient } from './config/database.js';

const port = Number(process.env.PORT || 3000);
const server = createServer(app);
server.once('listening', () => {
  console.log(`API: http://localhost:${server.address().port}`);
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Cannot start API: port ${port} is already in use. Stop the other API process or choose another PORT.`
    : `Cannot start API: ${error.message}`);
  process.exit(1);
});

server.listen(port, '127.0.0.1');

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
