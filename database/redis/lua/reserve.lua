local item_count = tonumber(ARGV[6])
local ttl_ms = tonumber(ARGV[5])

if redis.call('EXISTS', KEYS[1]) == 1 then
  return -1
end

local cursor = 7
for index = 1, item_count do
  local quantity = tonumber(ARGV[cursor + 1])
  local capacity = tonumber(ARGV[cursor + 2])
  local sold = tonumber(ARGV[cursor + 3])
  local held = tonumber(ARGV[cursor + 4])
  if quantity > capacity - sold - held then
    return 0
  end
  cursor = cursor + 5
end

redis.call(
  'HSET', KEYS[1],
  'id', ARGV[1],
  'user_id', ARGV[2],
  'showing_id', ARGV[3],
  'request_key', ARGV[4],
  'expires_at', ARGV[7 + item_count * 5]
)

local items_json = ARGV[8 + item_count * 5]
redis.call('HSET', KEYS[1], 'items', items_json)
redis.call('PEXPIRE', KEYS[1], ttl_ms)
return 1