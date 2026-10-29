import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

// Isolated schema only: never seed, truncate, or delete the application database.
const database = `eventbox_integration_${randomBytes(6).toString('hex')}`;
let connection;
try {
  const container = JSON.parse(execFileSync('docker', ['inspect', 'eventbox-mysql'], { encoding: 'utf8' }))[0];
  const values = Object.fromEntries(container.Config.Env.map(value => { const split = value.indexOf('='); return [value.slice(0, split), value.slice(split + 1)]; }));
  const port = container.NetworkSettings.Ports['3306/tcp'][0].HostPort;
  const env = { ...process.env, MYSQL_HOST: '127.0.0.1', MYSQL_PORT: port, MYSQL_USER: 'root', MYSQL_PASSWORD: values.MYSQL_ROOT_PASSWORD, MYSQL_DATABASE: database,
    JWT_SECRET: randomBytes(32).toString('hex'), TEST_INTEGRATION_MYSQL: '1', NODE_ENV: 'test', REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379', REDIS_PASSWORD: '' };
  connection = await mysql.createConnection({ host: env.MYSQL_HOST, port: Number(port), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, multipleStatements: true, charset: 'utf8mb4', timezone: 'Z' });
  await connection.query("SET time_zone = '+00:00'");
  const schema = await readFile(new URL('../../database/mysql/migrations/001_init_schema.sql', import.meta.url), 'utf8');
  await connection.query(schema.replaceAll('event_ticketing', database));
  // Exercise upgrades from the original F05/F06 schema as well as a fresh install.
  await connection.query('ALTER TABLE users MODIFY username VARCHAR(50) NOT NULL');
  await connection.query('ALTER TABLE event_showings ADD KEY idx_showings_event (event_id), DROP INDEX uq_showings_event_code, ADD UNIQUE KEY uq_showings_code (showing_code)');
  await connection.query('ALTER TABLE booking_items DROP COLUMN subtotal_vnd, ADD COLUMN subtotal_vnd BIGINT UNSIGNED NOT NULL');
  const cwd = new URL('../', import.meta.url);
  for (let pass = 0; pass < 2; pass++) {
    const migration = spawnSync(process.execPath, ['scripts/migrate.js'], { cwd, env, stdio: 'inherit' });
    if (migration.status !== 0) throw new Error('Migration test failed.');
  }
  const result = spawnSync(process.execPath, ['--test', 'test/integration.mysql.test.js'], { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exitCode = 1;
} catch (error) {
  console.error('Integration setup failed:', error.code || error.message);
  process.exitCode = 1;
} finally {
  if (connection) {
    await connection.query(`DROP DATABASE IF EXISTS ${database}`);
    await connection.end();
    console.log('Removed isolated integration database.');
  }
}
