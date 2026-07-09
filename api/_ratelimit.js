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

// [max request, window detik]. Default dikunci per IP; `allow()` menerima id
// eksplisit untuk mengunci per akun.
//
// Catatan soal IP: operator seluler memakai CGNAT, jadi banyak pelanggan tampak
// dari satu IP. Karena itu masukan dari user LOGIN dibatasi per akun, dan batas
// per IP hanya dipakai untuk anonim (dengan angka yang cukup longgar).
const LIMITS = {
  generate: [30, 10],
  quota: [60, 60],
  payment: [10, 3600],
  feedback_guard: [60, 3600], // pagar per IP sebelum token diverifikasi (anti-banjir)
  feedback_user: [10, 3600],  // per akun
  feedback_ip: [15, 3600],    // anonim, per IP
};

function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || 'unknown';
}

// Fixed-window counter. `id` menimpa IP sebagai identitas (mis. 'u:<uuid>').
// INCR + EXPIRE dijalankan dalam satu MULTI: sebelumnya EXPIRE bisa gagal setelah
// INCR sukses, meninggalkan kunci tanpa TTL yang menumpuk di Redis.
// Return true = boleh, false = kena limit.
async function allow(req, which, id) {
  const r = getRedis();
  const cfg = LIMITS[which];
  if (!r || !cfg) return true; // fail-open
  const [max, win] = cfg;
  const bucket = Math.floor(Date.now() / 1000 / win);
  const key = `rl:${which}:${id || clientIp(req)}:${bucket}`;
  try {
    const res = await r.multi().incr(key).expire(key, win).exec();
    const count = res && res[0] && res[0][1];
    if (typeof count !== 'number') return true;
    return count <= max;
  } catch (e) {
    return true; // Redis error → jangan hukum user
  }
}

module.exports = { allow };
