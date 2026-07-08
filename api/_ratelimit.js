// Rate limiter bersama (Upstash Redis) untuk endpoint publik.
// FAIL-OPEN: bila env Upstash belum ada / Redis error → tidak memblokir
// (endpoint tetap jalan). File diawali '_' → tidak jadi route Vercel.
let _limiters = null;
let _init = false;

function getLimiters() {
  if (_init) return _limiters;
  _init = true;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return (_limiters = null); // belum dikonfigurasi → skip
  try {
    const { Ratelimit } = require('@upstash/ratelimit');
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url, token });
    _limiters = {
      // main UX — longgar, cukup buat blokir bot yang hammer
      generate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '10 s'), prefix: 'rl:gen' }),
      feedback: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'rl:fb' }),
      payment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: 'rl:pay' }),
    };
  } catch (e) {
    _limiters = null;
  }
  return _limiters;
}

function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || 'unknown';
}

// Panggil di awal handler. Return true = boleh lanjut, false = kena limit (429).
async function allow(req, which) {
  const rl = getLimiters();
  if (!rl || !rl[which]) return true; // fail-open
  try {
    const { success } = await rl[which].limit(clientIp(req));
    return success;
  } catch (e) {
    return true; // Redis error → jangan hukum user
  }
}

module.exports = { allow };
