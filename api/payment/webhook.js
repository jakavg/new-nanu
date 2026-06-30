// Webhook notifikasi Midtrans. Memverifikasi keaslian notifikasi (lewat Midtrans
// CoreApi.notification yang mengecek status resmi ke server Midtrans), lalu menandai
// order sebagai paid + memberi premium. JANGAN pernah percaya klaim bayar dari client.
const { createClient } = require('@supabase/supabase-js');
const midtransClient = require('midtrans-client');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIDTRANS_SERVER_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MIDTRANS_SERVER_KEY) {
    res.status(500).json({ error: 'Server belum dikonfigurasi.' });
    return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (e) { body = null; }
  if (!body) { res.status(400).json({ error: 'Body tidak valid.' }); return; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const core = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    });

    // Verifikasi keaslian: ambil status resmi dari Midtrans berdasarkan notifikasi.
    const stat = await core.transaction.notification(body);
    const orderId = stat.order_id;
    const tStatus = stat.transaction_status;
    const fraud = stat.fraud_status;

    const paid = tStatus === 'settlement' || (tStatus === 'capture' && fraud === 'accept');

    if (paid) {
      const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('order_id', orderId)
        .maybeSingle();
      await supabase
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString(), raw: stat })
        .eq('order_id', orderId);
      if (order && order.user_id) {
        await supabase
          .from('profiles')
          .update({ is_premium: true, premium_since: new Date().toISOString() })
          .eq('id', order.user_id);
      }
    } else {
      // pending / deny / cancel / expire / failure → simpan status terakhir saja.
      await supabase.from('orders').update({ status: tStatus, raw: stat }).eq('order_id', orderId);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
