local cached_user_id = redis.call('HGET', KEYS[1], 'user_id')
if not cached_user_id then
  return 0
end
if cached_user_id ~= ARGV[1] then
  return -1
end
return redis.call('DEL', KEYS[1])