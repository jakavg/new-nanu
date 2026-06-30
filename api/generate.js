// Vercel Serverless Function — memanggil Claude di sisi server.
// API key TIDAK PERNAH dikirim ke browser; dibaca dari env var ANTHROPIC_API_KEY.
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// Untuk permintaan 'more' (Muat lebih banyak) wajib premium — diperiksa di server
// agar tidak bisa di-bypass dari client.
async function requirePremium(req) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return { ok: false, code: 500, error: 'Server belum dikonfigurasi.' };
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, code: 401, error: 'Harus login dulu.' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: ures, error: uerr } = await supabase.auth.getUser(token);
  const user = ures && ures.user;
  if (uerr || !user) return { ok: false, code: 401, error: 'Sesi tidak valid.' };
  const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  if (!(prof && prof.is_premium)) return { ok: false, code: 402, error: 'premium-required' };
  return { ok: true };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY belum diset di server.' });
    return;
  }

  let prompt = '';
  let mode = 'initial';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body && body.prompt;
    if (body && body.mode) mode = body.mode;
  } catch (e) {}

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt tidak valid.' });
    return;
  }

  // Batch pertama gratis; "Muat lebih banyak" butuh premium.
  if (mode === 'more') {
    const gate = await requirePremium(req);
    if (!gate.ok) { res.status(gate.code).json({ error: gate.error }); return; }
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
