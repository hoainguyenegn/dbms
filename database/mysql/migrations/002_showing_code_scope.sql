-- Select the target database before running this migration.
-- BR-01: showing codes are unique within an event, not globally.
SET @has_old_index = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'event_showings' AND index_name = 'uq_showings_code');
SET @ddl = IF(@has_old_index > 0,
  'ALTER TABLE event_showings DROP INDEX uq_showings_code, ADD UNIQUE KEY uq_showings_event_code (event_id, showing_code)',
  'SELECT 1');
PREPARE scope_migration FROM @ddl;
EXECUTE scope_migration;
DEALLOCATE PREPARE scope_migration;
