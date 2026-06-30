// Nanu — integrasi Supabase (Auth Google + simpan koleksi per akun).
//
// 1) Isi dua nilai di bawah dari Supabase: Project Settings → API.
// 2) Jalankan SQL pembuatan tabel (lihat instruksi dari Nanu/asisten).
// 3) Aktifkan provider Google di Authentication → Providers.
//
// Selama dua nilai ini masih kosong, aplikasi otomatis memakai mode lokal/demo
// sehingga preview tetap berjalan. Begitu diisi + di-deploy, login Google asli
// dan penyimpanan cloud per akun langsung aktif.

export const SUPABASE_URL = 'https://bsqiavisuorqgrywcblx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_4ky4s59MkwTA6QT6FMg7cA_BXxQgUdM'; // publishable key — aman di frontend (dilindungi RLS)

let _client = null;

export function configured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Tunggu library supabase-js (dimuat via <script> di helmet) lalu buat client.
export function getClient() {
  return new Promise((resolve) => {
    if (!configured()) { resolve(null); return; }
    if (_client) { resolve(_client); return; }
    let tries = 0;
    const tick = () => {
      if (window.supabase && window.supabase.createClient) {
        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        resolve(_client);
        return;
      }
      if (++tries > 50) { resolve(null); return; }
      setTimeout(tick, 120);
    };
    tick();
  });
}

// Profil user yang sudah login (atau null).
export async function getUser() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  const u = data && data.user;
  if (!u) return null;
  const m = u.user_metadata || {};
  const name = m.full_name || m.name || (u.email ? u.email.split('@')[0] : 'Pengguna');
  return {
    id: u.id,
    name,
    email: u.email || '',
    initial: ((name || '?').trim()[0] || '?').toUpperCase(),
    picture: m.avatar_url || m.picture || '',
  };
}

// Login Google lewat Supabase Auth (redirect penuh ke Google lalu balik ke redirectTo).
export async function signInWithGoogle(redirectTo) {
  const c = await getClient();
  if (!c) return { error: 'not-configured' };
  return c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo || window.location.href },
  });
}

export async function signOut() {
  const c = await getClient();
  if (!c) return;
  await c.auth.signOut();
}

// Ambil koleksi nama milik user yang login.
export async function fetchSaved() {
  const c = await getClient();
  if (!c) return [];
  const { data, error } = await c
    .from('saved_names')
    .select('name, meaning, origin, created_at')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map((r) => ({ name: r.name, meaning: r.meaning, origin: r.origin, ts: r.created_at }));
}

export async function addSaved(item) {
  const c = await getClient();
  if (!c) return false;
  const { data: ud } = await c.auth.getUser();
  const uid = ud && ud.user && ud.user.id;
  if (!uid) return false;
  const { error } = await c
    .from('saved_names')
    .upsert({ user_id: uid, name: item.name, meaning: item.meaning, origin: item.origin || null }, { onConflict: 'user_id,name' });
  return !error;
}

export async function removeSaved(name) {
  const c = await getClient();
  if (!c) return false;
  const { error } = await c.from('saved_names').delete().eq('name', name);
  return !error;
}
