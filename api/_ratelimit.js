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
// dari satu IP. Polanya (sama untuk generate/quota/payment/feedback, tiga tingkat
// — nama kunci sendiri yang menandakan perannya, bukan cuma komentar, supaya tidak
// ada lagi yang lupa melonggarkan *_guard saat menambah endpoint baru):
//   *_guard → pagar anti-banjir per IP, LONGGAR, jalan sebelum identitas diketahui.
//   *_user  → batas nyata untuk user LOGIN (per akun, kunci 'u:<uuid>').
//   *_ip    → batas nyata untuk anonim/token tak valid (tak ada identitas lain).
// payment_guard sengaja TIDAK dilonggarkan sebesar yang lain: tidak ada skenario
// legit banyak percobaan gagal-auth dari satu IP (beda dgn generate/quota yang
// anonim memang wajar trafiknya tinggi), jadi pagar ini tetap ketat untuk menahan
// percobaan token curian/kedaluwarsa.
const LIMITS = {
  generate_guard: [120, 10],
  generate_user: [30, 10],
  generate_ip: [30, 10],
  quota_guard: [180, 60],
  quota_user: [60, 60],
  quota_ip: [60, 60],
  payment_guard: [20, 3600],
  payment_user: [10, 3600],
  feedback_guard: [60, 3600],
  feedback_user: [10, 3600],
  feedback_ip: [15, 3600],
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
