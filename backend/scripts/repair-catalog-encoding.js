import { mkdir, writeFile } from 'node:fs/promises';
import { mysqlPool } from '../src/config/database.js';

// Reverse UTF-8 bytes incorrectly decoded as Windows-1252/Latin-1.
// Only accept a valid UTF-8 round trip that reduces recognizable mojibake.
const legacyDecoder = new TextDecoder('windows-1252');
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const reverse = new Map();
for (let byte = 0; byte < 256; byte++) reverse.set(legacyDecoder.decode(Uint8Array.of(byte)), byte);
const score = value => (value.match(/Ã|Ä|Â|á[º»]|â[€‚„…†‡‰‹‘’“”•–—˜™›]/gu) || []).length;
export function repairText(value) {
  if (typeof value !== 'string') return value;
  let current = value;
  for (let pass = 0; pass < 3 && score(current); pass++) {
    const bytes = [];
    for (const character of current) {
      const byte = reverse.get(character) ?? (character.codePointAt(0) <= 255 ? character.codePointAt(0) : undefined);
      if (byte === undefined) return current;
      bytes.push(byte);
    }
    try {
      const candidate = utf8Decoder.decode(Uint8Array.from(bytes));
      if (score(candidate) >= score(current)) break;
      current = candidate;
    } catch { break; }
  }
  return current;
}
async function main() {
  const apply = process.argv.includes('--apply');
  const columns = { events: ['title', 'description', 'category'], event_showings: ['venue_name', 'city_code'], ticket_types: ['type_name'] };
  let db;
  try {
    db = await mysqlPool.getConnection();
    await db.beginTransaction();
    const changes = [];
    for (const [table, names] of Object.entries(columns)) {
      const [rows] = await db.query(`SELECT id, ${names.join(', ')} FROM ${table} FOR UPDATE`);
      for (const row of rows) for (const column of names) {
        const after = repairText(row[column]);
        if (after !== row[column]) changes.push({ table, id: row.id, column, before: row[column], after });
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', changes }, null, 2));
    if (apply && changes.length) {
      const directory = new URL('../../tmp/encoding-backups/', import.meta.url);
      await mkdir(directory, { recursive: true });
      const backup = new URL(`catalog-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, directory);
      await writeFile(backup, JSON.stringify(changes, null, 2), { flag: 'wx', mode: 0o600 });
      for (const change of changes) await db.execute(`UPDATE ${change.table} SET ${change.column} = ? WHERE id = ?`, [change.after, change.id]);
      await db.commit();
      console.log(`Repaired ${changes.length} values; backup: ${backup.pathname}`);
    } else await db.rollback();
  } catch (error) {
    if (db) await db.rollback();
    console.error('Encoding repair failed:', error.code || error.message);
    process.exitCode = 1;
  } finally {
    db?.release();
    await mysqlPool.end();
  }
}
if (process.argv[1] && new URL(process.argv[1], 'file://').href === import.meta.url) await main();
