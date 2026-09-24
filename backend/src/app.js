import cors from 'cors';
import express from 'express';
import { mysqlPool, redisClient } from './config/database.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
app.use(express.json());

app.get('/', (_request, response) => {
  response.json({ name: 'Event Ticketing API', version: '1.0.0' });
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

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' });
});

export default app;
