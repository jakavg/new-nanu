// TEMP diagnostic — lihat nama env var terkait Upstash/Redis/KV (tanpa bocorkan value)
// + apakah paket @upstash ke-load. HAPUS setelah rate-limit beres.
module.exports = async (req, res) => {
  const names = Object.keys(process.env).filter((k) => /UPSTASH|REDIS|KV_|STORAGE/i.test(k)).sort();
  let pkgLoaded = false, pkgErr = null;
  try { require('@upstash/ratelimit'); require('@upstash/redis'); pkgLoaded = true; }
  catch (e) { pkgErr = String((e && e.message) || e).slice(0, 120); }
  res.status(200).json({ matchingEnvVarNames: names, upstashPkgLoaded: pkgLoaded, pkgErr });
};
