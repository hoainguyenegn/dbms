import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { createClient } from 'redis';

dotenv.config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

for (const key of ['MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

export const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 20,
  connectTimeout: 3000,
});

export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    connectTimeout: 3000,
  },
  password: process.env.REDIS_PASSWORD || undefined,
  disableOfflineQueue: true,
});

redisClient.on('error', (error) => {
  console.error('Redis connection error:', error.message);
});
