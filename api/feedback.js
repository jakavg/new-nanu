// Simpan masukan/feedback pengguna ke Supabase (tabel `feedback`).
// Insert lewat service-role agar tabel tetap terkunci (RLS tanpa policy publik).
// user_id diambil dari token sesi (bila login) supaya tidak bisa dipalsukan client.
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server belum dikonfigurasi.' });
    return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (e) { body = null; }
  if (!body) { res.status(400).json({ error: 'Body tidak valid.' }); return; }

  // Honeypot: bila terisi, kemungkinan bot → pura-pura sukses tanpa menyimpan.
  if (body.hp) { res.status(200).json({ ok: true }); return; }

  const message = String(body.message || '').trim();
  if (!message) { res.status(400).json({ error: 'Pesan tidak boleh kosong.' }); return; }
  if (message.length > 1000) { res.status(400).json({ error: 'Pesan terlalu panjang (maks 1000 karakter).' }); return; }

  const email = String(body.email || '').trim().slice(0, 200) || null;
  const page = String(body.page || '').trim().slice(0, 120) || null;
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 400) || null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Bila ada token sesi, ambil user_id terverifikasi (jangan percaya klaim client).
  let userId = null;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      if (data && data.user) userId = data.user.id;
    } catch (e) { /* anonim */ }
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    email,
    message,
    page,
    user_agent: userAgent,
  });
  if (error) { res.status(500).json({ error: 'Gagal menyimpan masukan.', detail: String(error.message || error) }); return; }

  res.status(200).json({ ok: true });
};
