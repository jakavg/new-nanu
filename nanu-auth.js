// Nanu — Google Identity Services (GIS) helper.
// Ganti CLIENT_ID jika perlu. Wajib: domain tempat deploy didaftarkan di
// Google Cloud Console → Credentials → OAuth Client ID → Authorized JavaScript origins.
export const GOOGLE_CLIENT_ID = '1082212826706-782qn8g4coabi3nma5nqhocsov593ims.apps.googleusercontent.com';

// Decode payload JWT dari Google (tanpa verifikasi tanda tangan — verifikasi dilakukan di backend bila ada).
export function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(part).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export function ready() {
  return !!(window.google && window.google.accounts && window.google.accounts.id);
}

let _inited = false;

// Tunggu library GIS termuat, lalu inisialisasi. Resolve true bila siap, false bila gagal.
export function init(onProfile) {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      if (ready()) {
        if (!_inited) {
          try {
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: (resp) => {
                const p = decodeJwt(resp.credential);
                if (p && typeof onProfile === 'function') onProfile(p);
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });
            _inited = true;
          } catch (e) {}
        }
        resolve(true);
        return;
      }
      if (++tries > 50) { resolve(false); return; }
      setTimeout(tick, 120);
    };
    tick();
  });
}

// Render tombol Google resmi ke dalam elemen container.
export function renderButton(el, opts) {
  if (!ready() || !el) return false;
  try {
    el.innerHTML = '';
    window.google.accounts.id.renderButton(el, Object.assign({
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width: 300,
    }, opts || {}));
    return true;
  } catch (e) {
    return false;
  }
}
