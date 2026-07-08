// TEMP diagnostic — cek koneksi Redis. HAPUS setelah rate-limit beres.
module.exports = async (req, res) => {
  const names = Object.keys(process.env).filter((k) => /UPSTASH|REDIS|KV_|STORAGE/i.test(k)).sort();
  const out = { matchingEnvVarNames: names };

  // Coba turunkan REST url/token dari REDIS_URL (rediss://default:PWD@HOST:PORT)
  let url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  let token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  let derived = false;
  if ((!url || !token) && process.env.REDIS_URL) {
    try {
      const u = new URL(process.env.REDIS_URL);
      url = 'https://' + u.hostname;
      token = decodeURIComponent(u.password || '');
      derived = true;
    } catch (e) {}
  }
  out.restUrlHost = url ? url.replace(/^https?:\/\//, '') : null;
  out.hasToken = !!token;
  out.derivedFromRedisUrl = derived;

  // Uji konek: set+get lewat @upstash/redis (REST)
  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url, token });
    const k = 'rldebug:ping';
    await redis.set(k, 'ok', { ex: 30 });
    out.pingResult = await redis.get(k);
    out.connectionOk = out.pingResult === 'ok';
  } catch (e) {
    out.connectionOk = false;
    out.connErr = String((e && e.message) || e).slice(0, 160);
  }
  res.status(200).json(out);
};
