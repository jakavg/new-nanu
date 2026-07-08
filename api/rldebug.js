// TEMP diagnostic — tes koneksi ioredis. HAPUS setelah rate-limit beres.
module.exports = async (req, res) => {
  const hasUrl = !!process.env.REDIS_URL;
  const out = { hasRedisUrl: hasUrl };
  try {
    const IORedis = require('ioredis');
    const r = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 4000 });
    r.on('error', () => {});
    await r.set('rldebug:ping', 'ok', 'EX', 30);
    out.pingResult = await r.get('rldebug:ping');
    out.connectionOk = out.pingResult === 'ok';
    r.disconnect();
  } catch (e) {
    out.connectionOk = false;
    out.connErr = String((e && e.message) || e).slice(0, 160);
  }
  res.status(200).json(out);
};
