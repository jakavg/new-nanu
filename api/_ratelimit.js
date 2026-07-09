// Rate limiter bersama (Redis TCP via REDIS_URL, mis. Redis Cloud/Vercel).
// FAIL-OPEN: bila REDIS_URL tak ada / Redis error → tidak memblokir.
// File diawali '_' → tidak jadi route Vercel.
let _redis = null; // null = belum coba, false = tak tersedia

function getRedis() {
  if (_redis !== null) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return (_redis = false);
  try {
    const IORedis = require('ioredis');
    _redis = new IORedis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      enableOfflineQueue: true,
    });
    _redis.on('error', () => {}); // jangan biarkan error koneksi meng-crash function
  } catch (e) {
    _redis = false;
  }
  return _redis;
}

// [max request, window detik] per IP
const LIMITS = { generate: [30, 10], feedback: [5, 3600], payment: [10, 3600], quota: [60, 60] };

function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || 'unknown';
}

// Fixed-window counter: INCR + EXPIRE. Return true = boleh, false = kena limit.
async function allow(req, which) {
  const r = getRedis();
  const cfg = LIMITS[which];
  if (!r || !cfg) return true; // fail-open
  const [max, win] = cfg;
  const bucket = Math.floor(Date.now() / 1000 / win);
  const key = `rl:${which}:${clientIp(req)}:${bucket}`;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, win);
    return count <= max;
  } catch (e) {
    return true; // Redis error → jangan hukum user
  }
}

module.exports = { allow };
