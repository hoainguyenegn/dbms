import { readFile } from 'node:fs/promises';
import { mysqlPool } from '../src/config/database.js';

let connection;
try {
  connection = await mysqlPool.getConnection();
  // The base schema must already exist. Never replay schema/seed on an existing DB.
  for (const file of ['002_showing_code_scope.sql', '003_registration_otps.sql']) {
    const sql = await readFile(new URL(`../../database/mysql/migrations/${file}`, import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await connection.query(statement);
    console.log(`Applied ${file}`);
  }
  await connection.query('ALTER TABLE users MODIFY username VARCHAR(254) NOT NULL');
  await connection.query('ALTER TABLE registration_otps MODIFY username VARCHAR(254) NOT NULL');
  const [[column]] = await connection.query("SELECT EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_items' AND COLUMN_NAME = 'subtotal_vnd'");
  if (!column) throw new Error('Missing booking_items.subtotal_vnd; initialize base schema first.');
  if (!column.extra.includes('GENERATED')) {
    const [[inconsistent]] = await connection.query('SELECT COUNT(*) AS total FROM booking_items WHERE subtotal_vnd <> unit_price_vnd * quantity');
    if (inconsistent.total) throw new Error('Existing subtotals differ from price × quantity; review data before conversion.');
    await connection.query('ALTER TABLE booking_items DROP COLUMN subtotal_vnd, ADD COLUMN subtotal_vnd BIGINT UNSIGNED GENERATED ALWAYS AS (unit_price_vnd * quantity) STORED');
    console.log('Converted subtotal_vnd to a generated column.');
  }
  console.log('Integration migrations completed.');
} catch (error) {
  console.error('Migration failed:', error.code || error.message);
  process.exitCode = 1;
} finally {
  connection?.release();
  await mysqlPool.end();
}
