// Cek kuota generate — READ-ONLY, tidak mengonsumsi jatah apa pun.
// Dipakai beranda untuk tahu lebih dulu apakah generate berikutnya akan diblokir,
// sehingga modal limit bisa muncul di atas beranda (user tak melihat list kosong).
const { createClient } = require('@supabase/supabase-js');
const { allow } = require('./_ratelimit');

// Harus sama dengan FREE_LIMIT di api/generate.js.
const FREE_LIMIT = 5;

function getServiceClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Tanggal "hari ini" zona Asia/Jakarta (UTC+7) — samakan dengan consume_daily_peek.
function todayJakarta() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// Fail-open: kalau ragu, jangan blokir di client — gate asli tetap di api/generate.js.
const OPEN = { premium: false, blocked: false, remaining: null };

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!(await allow(req, 'quota'))) { res.status(429).json({ error: 'Terlalu banyak permintaan.' }); return; }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  // Anonim dibatasi di client (localStorage) — server tak menyimpan hitungannya.
  if (!token) { res.status(200).json(OPEN); return; }

  const supabase = getServiceClient();
  if (!supabase) { res.status(200).json(OPEN); return; }

  try {
    const { data: ures } = await supabase.auth.getUser(token);
    const user = ures && ures.user;
    if (!user) { res.status(200).json(OPEN); return; }

    const { data: prof } = await supabase
      .from('profiles').select('is_premium, free_uses, last_peek_date').eq('id', user.id).maybeSingle();

    if (prof && prof.is_premium) { res.status(200).json({ premium: true, blocked: false, remaining: null }); return; }

    const remaining = Math.max(0, FREE_LIMIT - ((prof && prof.free_uses) || 0));
    const peekUsedToday = !!(prof && prof.last_peek_date === todayJakarta());
    // Terblokir hanya bila jatah lifetime habis DAN "1x lihat harian" sudah dipakai.
    res.status(200).json({ premium: false, blocked: remaining === 0 && peekUsedToday, remaining });
  } catch (e) {
    res.status(200).json(OPEN);
  }
};
