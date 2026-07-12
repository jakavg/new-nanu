// Vercel Serverless Function — sumber nama 100% dari name bank (ZERO-AI).
// Semua origin (islami, sansekerta, jawa) dilayani dari Supabase; TIDAK ADA
// pemanggilan AI/Claude sama sekali. Bila kata kunci tak menemukan hasil, kata
// kunci dilonggarkan (diabaikan) agar user tetap mendapat nama asli dari bank.
const { createClient } = require('@supabase/supabase-js');
const { allow } = require('./_ratelimit');

// Jatah generate gratis untuk user LOGIN non-premium (lifetime, dihitung server).
// Anonim dibatasi di client via localStorage (lihat Daftar-Nama.dc.html).
const FREE_LIMIT = 5;

function getServiceClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Untuk permintaan 'more' (Muat lebih banyak) wajib premium — diperiksa di server
// agar tidak bisa di-bypass dari client.
async function requirePremium(req, supabase) {
  if (!supabase) return { ok: false, code: 500, error: 'Server belum dikonfigurasi.' };
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, code: 401, error: 'Harus login dulu.' };
  const { data: ures, error: uerr } = await supabase.auth.getUser(token);
  const user = ures && ures.user;
  if (uerr || !user) return { ok: false, code: 401, error: 'Sesi tidak valid.' };
  if (!(await allow(req, 'generate_user', 'u:' + user.id))) {
    return { ok: false, code: 429, error: 'Terlalu banyak permintaan, coba lagi sebentar ya.' };
  }
  const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  if (!(prof && prof.is_premium)) return { ok: false, code: 402, error: 'premium-required' };
  return { ok: true };
}

// Ambil dari name bank. Mengembalikan array [{name,meaning}] (bisa kosong) bila
// origin tercakup, atau null bila origin belum punya bank / terjadi error.
async function serveFromBank(supabase, { origin, gender, length, keyword, count, exclude }) {
  if (!supabase || !origin) return null;
  const { data: covered } = await supabase.rpc('bank_has_origin', { p_origin: origin });
  if (!covered) return null;
  const { data, error } = await supabase.rpc('pick_bank_names', {
    p_origin: origin,
    p_gender: gender || null,
    p_length: Number.isFinite(length) ? length : null,
    p_keyword: keyword || '',
    p_limit: count || 5,
    p_exclude: Array.isArray(exclude) ? exclude : [],
  });
  if (error) return null;
  return (data || []).map((r) => ({ name: r.name, meaning: r.meaning }));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await allow(req, 'generate_guard'))) {
    res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar ya.' });
    return;
  }

  let mode = 'initial';
  let filters = {};
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body && body.mode) mode = body.mode;
    if (body) {
      filters = {
        origin: body.origin,
        gender: body.gender,
        length: parseInt(body.length, 10),
        keyword: (body.keyword || '').trim(),
        count: body.count || 5,
        exclude: body.exclude || [],
      };
    }
  } catch (e) {}

  const supabase = getServiceClient();
  if (!supabase) { res.status(500).json({ error: 'Server belum dikonfigurasi.' }); return; }

  // "Muat lebih banyak" butuh premium.
  if (mode === 'more') {
    const gate = await requirePremium(req, supabase);
    if (!gate.ok) { res.status(gate.code).json({ error: gate.error }); return; }
  } else {
    // mode 'initial': user LOGIN non-premium dibatasi FREE_LIMIT (dihitung server,
    // tak bisa di-bypass clear storage). Anonim → dibatasi per IP (generate_ip) di
    // server + localStorage di client. Premium → unlimited.
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    let user = null;
    if (token) {
      try {
        const { data: ures } = await supabase.auth.getUser(token);
        user = ures && ures.user;
      } catch (e) { user = null; /* token invalid → diperlakukan sebagai anonim */ }
    }
    if (user) {
      if (!(await allow(req, 'generate_user', 'u:' + user.id))) {
        res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar ya.' });
        return;
      }
      try {
        const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
        if (!(prof && prof.is_premium)) {
          // Ambil `error` juga: RPC bisa gagal di level DB (mis. migrasi, deadlock)
          // dan mengembalikan {data:null, error} TANPA throw — kalau cuma dicek
          // `allowed !== true`, itu bikin `undefined !== true` = true = "jatah
          // habis", padahal seharusnya fail-open (sama kelas masalah dgn network
          // error yang tertangkap catch di bawah).
          const { data: allowed, error: freeErr } = await supabase.rpc('consume_free_use', { p_uid: user.id, p_limit: FREE_LIMIT });
          if (!freeErr && allowed !== true) {
            // Jatah lifetime habis → beri "1x lihat per hari" (waktu Asia/Jakarta)
            // agar returning user tetap dapat 1 list nama dulu; generate berikutnya
            // di hari yang sama baru memunculkan paywall.
            const { data: peek, error: peekErr } = await supabase.rpc('consume_daily_peek', { p_uid: user.id });
            if (!peekErr && peek !== true) { res.status(200).json({ text: '[]', source: 'bank', limit: 'free' }); return; }
          }
        }
      } catch (e) { /* Supabase tersendat → fail-open: biarkan user dapat nama (sama seperti perilaku semula) */ }
    } else {
      // Anonim (atau token invalid): tak ada identitas selain IP → batasi per IP.
      if (!(await allow(req, 'generate_ip'))) {
        res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar ya.' });
        return;
      }
    }
  }

  try {
    // 1) Coba dengan kata kunci.
    const names = await serveFromBank(supabase, filters);
    if (names === null) {
      // Origin belum tercakup bank (semestinya tidak terjadi). Tanpa AI → kosongkan.
      res.status(200).json({ text: '[]', source: 'bank', empty: true });
      return;
    }
    if (names.length) {
      res.status(200).json({ text: JSON.stringify(names), source: 'bank' });
      return;
    }
    // 2) Kata kunci tak menemukan hasil → longgarkan (abaikan kata kunci).
    if (filters.keyword) {
      const relaxed = await serveFromBank(supabase, Object.assign({}, filters, { keyword: '' }));
      if (relaxed && relaxed.length) {
        res.status(200).json({ text: JSON.stringify(relaxed), source: 'bank', relaxed: true, keyword: filters.keyword });
        return;
      }
    }
    // 3) Tetap kosong (mis. exclude sudah menghabiskan bucket).
    res.status(200).json({ text: '[]', source: 'bank', empty: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil nama.', detail: String((e && e.message) || e) });
  }
};
