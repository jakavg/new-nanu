// Cek status pembayaran + status premium user (dipakai client untuk polling
// setelah popup Snap ditutup, karena webhook butuh sedikit waktu).
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server belum dikonfigurasi.' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'Harus login dulu.' }); return; }

  let orderId = (req.query && req.query.order_id) || '';
  if (!orderId && req.body) {
    try {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      orderId = (b && b.order_id) || '';
    } catch (e) {}
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ures, error: uerr } = await supabase.auth.getUser(token);
  const user = ures && ures.user;
  if (uerr || !user) { res.status(401).json({ error: 'Sesi tidak valid.' }); return; }

  const { data: prof } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();

  let orderStatus = null;
  if (orderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .maybeSingle();
    orderStatus = order ? order.status : null;
  }

  res.status(200).json({ premium: !!(prof && prof.is_premium), orderStatus });
};
