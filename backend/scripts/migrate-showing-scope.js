import { readFile } from 'node:fs/promises';
import { mysqlPool } from '../src/config/database.js';
let connection;
try {
  connection = await mysqlPool.getConnection();
  const sql = await readFile(new URL('../../database/mysql/migrations/002_showing_code_scope.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await connection.query(statement);
  console.log('Showing-code scope migration completed.');
} catch (error) {
  console.error('Migration failed:', error.code || error.name);
  process.exitCode = 1;
} finally {
  connection?.release();
  await mysqlPool.end();
}
