// Buat transaksi Midtrans Snap untuk membuka fitur generate tak terbatas (sekali bayar).
// Memverifikasi sesi Supabase, mencatat order PENDING, lalu mengembalikan Snap token.
const { createClient } = require('@supabase/supabase-js');
const midtransClient = require('midtrans-client');

const PRICE = 1000; // TEST: Rp 1.000 untuk uji coba produksi — kembalikan ke 49999 sebelum launch

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIDTRANS_SERVER_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MIDTRANS_SERVER_KEY) {
    res.status(500).json({ error: 'Server belum dikonfigurasi (env var hilang).' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'Harus login dulu.' }); return; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ures, error: uerr } = await supabase.auth.getUser(token);
  const user = ures && ures.user;
  if (uerr || !user) { res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang.' }); return; }

  // Sudah premium? Tidak perlu bayar lagi.
  const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  if (prof && prof.is_premium) { res.status(200).json({ alreadyPremium: true }); return; }

  const orderId = 'nanu-' + user.id.slice(0, 8) + '-' + Date.now();
  const { error: oerr } = await supabase
    .from('orders')
    .insert({ order_id: orderId, user_id: user.id, amount: PRICE, status: 'pending' });
  if (oerr) { res.status(500).json({ error: 'Gagal membuat order.', detail: String(oerr.message || oerr) }); return; }

  try {
    const snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: MIDTRANS_SERVER_KEY,
    });
    const tx = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: PRICE },
      item_details: [{ id: 'nanu-unlimited', price: PRICE, quantity: 1, name: 'Nanu Unlimited (sekali bayar)' }],
      customer_details: { email: user.email, first_name: (user.user_metadata && user.user_metadata.full_name) || user.email },
      credit_card: { secure: true },
    });
    res.status(200).json({ token: tx.token, redirectUrl: tx.redirect_url, orderId });
  } catch (e) {
    res.status(502).json({ error: 'Gagal membuat transaksi Midtrans.', detail: String((e && e.message) || e) });
  }
};
