// Vercel Serverless Function — sumber nama.
// Untuk origin yang sudah punya "name bank" (mis. islami) nama dilayani langsung
// dari Supabase TANPA memanggil Claude (hemat kredit AI). Origin lain memakai Claude.
// API key Claude TIDAK PERNAH dikirim ke browser; dibaca dari env ANTHROPIC_API_KEY.
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

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
  const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  if (!(prof && prof.is_premium)) return { ok: false, code: 402, error: 'premium-required' };
  return { ok: true };
}

// Layani dari name bank (zero-AI). Mengembalikan array [{name,meaning}] atau null
// bila origin tidak tercakup / tidak ada hasil (caller boleh fallback ke Claude).
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
  if (error || !data || !data.length) return null;
  return data.map((r) => ({ name: r.name, meaning: r.meaning }));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let prompt = '';
  let mode = 'initial';
  let filters = {};
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body && body.prompt;
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

  // Batch pertama gratis; "Muat lebih banyak" butuh premium.
  if (mode === 'more') {
    const gate = await requirePremium(req, supabase);
    if (!gate.ok) { res.status(gate.code).json({ error: gate.error }); return; }
  }

  // 1) Coba name bank dulu (zero-AI) untuk origin yang sudah tercakup.
  try {
    const bank = await serveFromBank(supabase, filters);
    if (bank && bank.length) {
      res.status(200).json({ text: JSON.stringify(bank), source: 'bank' });
      return;
    }
  } catch (e) {
    // abaikan — lanjut ke Claude
  }

  // 2) Fallback ke Claude (origin belum punya bank, mis. jawa/sansekerta, atau
  //    keyword yang tak ada di bank). Butuh prompt + API key.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY belum diset di server.' });
    return;
  }
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt tidak valid.' });
    return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Gagal menghubungi Claude.', detail: String((e && e.message) || e) });
  }
};
