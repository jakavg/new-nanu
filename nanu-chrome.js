/* nanu-chrome.js — Navbar & footer BERSAMA untuk semua halaman Nanu.
 *
 * Dipakai halaman dc-runtime (Nanu / Daftar-Nama / Nama-Tersimpan) maupun
 * halaman HTML statis (privasi / ketentuan / faq). Tampilannya mengikuti
 * beranda sebagai sumber kebenaran.
 *
 * PENTING — kedua elemen ini harus diletakkan DI LUAR <x-dc> (root React
 * dc-runtime). Dengan begitu komponen boleh menulis LIGHT DOM: link footer
 * tetap terbaca di HTML mentah (syarat verifikasi Google + SEO), dan React
 * tidak pernah bentrok merapikan anak yang bukan miliknya.
 *
 * Komunikasi dengan halaman (opsional, semuanya via event di `document`):
 *   - keluar : 'nanu:login'   → cancelable. Halaman yang punya modal login
 *              kontekstual memanggil preventDefault() lalu membuka modalnya.
 *              Bila tak ada yang menangani, navbar langsung ke Google.
 *   - masuk  : 'nanu:saved'   → detail { count }  (badge "Tersimpan")
 *   - masuk  : 'nanu:premium' → detail { premium } (mahkota + pil Premium)
 */
(function () {
  if (window.__nanuChrome) return;
  window.__nanuChrome = true;

  // ---------------------------------------------------------------- state
  var sb = null;            // modul nanu-supabase.js (dimuat malas)
  var user = null;
  var premium = false;
  var savedCount = 0;
  var menuOpen = false;

  var navbars = [];
  var footers = [];

  var CAN_HOVER = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

  // Navbar dilukis sebelum auth selesai (~0,5 dtk). Tanpa ingatan, user yang sudah
  // login melihat kilatan "Masuk" + badge hilang tiap pindah halaman. Kita simpan
  // keadaan terakhir lalu merekonsiliasinya begitu auth sungguhan tiba.
  var CACHE_KEY = 'nanu_chrome_v1';

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeCache() {
    try {
      if (!user) { localStorage.removeItem(CACHE_KEY); return; }
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        name: user.name, email: user.email, initial: user.initial, picture: user.picture,
        premium: premium, savedCount: savedCount,
      }));
    } catch (e) {}
  }
  function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }

  // Toast yang harus tampil SETELAH halaman berpindah (mis. "Kamu telah keluar").
  function queueToast(msg) { try { sessionStorage.setItem('nanu_toast', msg); } catch (e) {} }
  function flushToast() {
    try {
      var m = sessionStorage.getItem('nanu_toast');
      if (m) { sessionStorage.removeItem('nanu_toast'); toast(m); }
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // nanu-supabase.js menunggu global `window.supabase` (UMD dari CDN). Halaman dc
  // memuatnya lewat <helmet>, halaman statis tidak — dulu itu membuat navbar di
  // /privasi & /ketentuan selalu tampak logout dan tombol "Masuk" mati. Komponen
  // kini memastikan sendiri library-nya ada, sehingga jalan di semua halaman.
  var libP = null;
  function ensureLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise(function (resolve) {
      if (!document.querySelector('script[src*="@supabase/supabase-js"]')) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onerror = resolve; // gagal muat → getClient() mengembalikan null, tidak crash
        (document.head || document.documentElement).appendChild(s);
      }
      var n = 0;
      (function tick() {
        if (window.supabase && window.supabase.createClient) return resolve();
        if (++n > 60) return resolve();
        setTimeout(tick, 100);
      })();
    });
    return libP;
  }

  function supabase() {
    if (!sb) sb = ensureLib().then(function () { return import('/nanu-supabase.js'); });
    return sb;
  }

  // ---------------------------------------------------------------- gaya
  var CSS = [
    'body{min-height:100vh;display:flex;flex-direction:column;margin:0;background:#F9EFEB}',
    'body>#dc-root{flex:1;display:flex;flex-direction:column}',
    'body>#dc-root>div{flex:1;display:flex;flex-direction:column}',
    // Sticky harus di elemen kustomnya: <header> di dalamnya setinggi induknya,
    // jadi position:sticky di sana tidak pernah menempel saat scroll.
    'nanu-navbar{display:block;position:sticky;top:0;z-index:40}',
    '.nnu-nav{background:rgba(249,239,235,.86);backdrop-filter:blur(10px);border-bottom:1px solid #EDE2DC}',
    '.nnu-nav-in{max-width:880px;width:100%;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}',
    '.nnu-logo{display:flex;align-items:center;text-decoration:none}',
    '.nnu-logo img{height:42px;width:auto;display:block}',
    '.nnu-links{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.nnu-saved{background:none;border:none;cursor:pointer;font-weight:600;font-size:14px;color:#0B2A3A;padding:8px 12px;border-radius:10px;display:flex;align-items:center;gap:7px;font-family:inherit}',
    '.nnu-badge{background:#EE5B3A;color:#fff;font-size:11px;font-weight:700;min-width:19px;height:19px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}',
    '.nnu-signin{background:#0B2A3A;border:none;cursor:pointer;font-weight:600;font-size:14px;color:#fff;padding:9px 18px;border-radius:999px;font-family:inherit}',
    '.nnu-ava-wrap{position:relative}',
    '.nnu-ava-btn{background:none;border:none;cursor:pointer;padding:0;display:flex;border-radius:50%}',
    '.nnu-ava{width:34px;height:34px;border-radius:50%;background-size:cover;background-position:center;background-repeat:no-repeat}',
    '.nnu-ava-i{width:34px;height:34px;border-radius:50%;background:#3CA274;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:"Baloo 2",cursive;font-size:16px}',
    '.nnu-crown{position:absolute;bottom:-2px;right:-2px;width:17px;height:17px;border-radius:50%;background:#F6B93B;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px -1px rgba(11,42,58,.35);pointer-events:none}',
    '.nnu-menu{position:absolute;top:34px;right:0;padding-top:10px;z-index:55}',
    '.nnu-menu-card{background:#fff;border:1px solid #EDE2DC;border-radius:16px;box-shadow:0 18px 44px -16px rgba(11,42,58,.4);padding:15px;min-width:230px}',
    '.nnu-me{display:flex;align-items:center;gap:11px;margin-bottom:13px}',
    '.nnu-ava-lg{width:38px;height:38px;border-radius:50%;background-size:cover;background-position:center;flex:0 0 auto}',
    '.nnu-ava-lg-i{width:38px;height:38px;border-radius:50%;background:#3CA274;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:"Baloo 2",cursive;font-size:17px;flex:0 0 auto}',
    '.nnu-name{font-weight:700;font-size:14px;color:#0B2A3A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.nnu-email{font-size:12.5px;color:#8A969C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.nnu-pill{display:inline-flex;align-items:center;gap:4px;margin-top:5px;background:#FFF4DA;color:#B77A00;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px}',
    '.nnu-logout{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:#F9EFEB;border:1px solid #EDE2DC;border-radius:10px;padding:10px;font-weight:700;font-size:13.5px;color:#EE5B3A;cursor:pointer;font-family:inherit}',
    '.nnu-logout:hover{background:#FDEAE4;border-color:#EE5B3A}',
    // Selama app dc-runtime masih dimuat, bagian tengah kosong; margin-top:auto
    // menahan footer tetap di dasar layar sehingga tak "melompat" ke atas.
    'nanu-footer{display:block;margin-top:auto;width:100%}',
    // Link fallback statis (ada di HTML mentah demi crawler & verifikasi Google).
    // Script ini blocking, jadi connectedCallback jalan saat <nanu-footer> masih
    // kosong; parser lalu menempelkan <a> fallback SETELAH footer yang kita render.
    // Sembunyikan langsung, dan buang dari DOM begitu parsing selesai.
    'nanu-footer > a{display:none}',
    '.nnu-foot{width:100%;padding:26px 20px 40px;text-align:center;border-top:1px solid #EDE2DC}',
    '.nnu-foot-links{display:flex;flex-wrap:wrap;gap:9px 18px;align-items:center;justify-content:center;margin-bottom:12px}',
    '.nnu-foot-links a,.nnu-fb-open{color:#5C6B72;font-weight:600;font-size:13.5px;text-decoration:none;background:none;border:none;cursor:pointer;padding:0;font-family:inherit}',
    '.nnu-fb-open:hover,.nnu-foot-links a:hover{color:#3CA274}',
    '.nnu-copy{color:#A9B3B8;font-size:12.5px}',
    '.nnu-ovl{position:fixed;inset:0;z-index:70;background:rgba(11,42,58,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}',
    '.nnu-modal{background:#fff;border-radius:26px;max-width:400px;width:100%;padding:30px;box-shadow:0 30px 70px -20px rgba(11,42,58,.4)}',
    '.nnu-modal h3{font-family:"Baloo 2",cursive;font-weight:700;font-size:22px;margin:0 0 6px;color:#0B2A3A}',
    '.nnu-modal p{color:#5C6B72;font-size:14px;margin:0 0 18px}',
    '.nnu-modal textarea,.nnu-modal input{width:100%;box-sizing:border-box;border:2px solid #EDE2DC;border-radius:14px;padding:12px 14px;font-family:inherit;font-size:14.5px;color:#0B2A3A;outline:none}',
    '.nnu-modal textarea:focus,.nnu-modal input:focus{border-color:#3CA274}',
    '.nnu-modal textarea{min-height:110px;resize:vertical;margin-bottom:10px}',
    '.nnu-send{width:100%;background:#3CA274;border:none;color:#fff;font-family:"Baloo 2",cursive;font-weight:700;font-size:16px;padding:13px;border-radius:14px;cursor:pointer;margin-top:14px}',
    '.nnu-send[disabled]{opacity:.6;cursor:default}',
    '.nnu-cancel{background:none;border:none;color:#8A969C;font-weight:600;font-size:13.5px;margin-top:12px;cursor:pointer;width:100%;font-family:inherit}',
    '.nnu-hp{position:absolute;left:-9999px;width:1px;height:1px}',
    '.nnu-modal-c{text-align:center}',
    '.nnu-modal-c p{margin:0 0 26px}',
    '.nnu-modal-logo{height:30px;margin:0 auto 22px;display:block}',
    '.nnu-google{width:100%;display:flex;align-items:center;justify-content:center;gap:11px;background:#fff;border:2px solid #EDE2DC;border-radius:14px;padding:14px;font-weight:700;font-size:15px;color:#0B2A3A;cursor:pointer;font-family:inherit}',
    '.nnu-google:hover{border-color:#185FA4;background:#FCF7F4}',
    '.nnu-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:90;background:#0B2A3A;color:#fff;font-weight:600;font-size:14px;padding:13px 22px;border-radius:999px;box-shadow:0 14px 40px -12px rgba(11,42,58,.6)}',
  ].join('');

  function injectCss() {
    if (document.getElementById('nnu-css')) return;
    var st = document.createElement('style');
    st.id = 'nnu-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var CROWN = '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"></path></svg>';
  var CROWN_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#F6B93B"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"></path></svg>';
  var EXIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg>';
  var GOOGLE = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.8z"></path><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.3-2-6.2-4.6H2.2v2.8A11 11 0 0 0 12 23z"></path><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z"></path><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z"></path></svg>';

  // ---------------------------------------------------------------- aksi
  var LOGIN_DEFAULT = ['Masuk ke Nanu', 'Simpan & kelola nama favoritmu agar bisa diakses kapan saja dari perangkat mana pun.'];

  // Halaman dc punya modal login kontekstualnya sendiri: mereka memanggil
  // preventDefault() lalu memakai `detail` untuk teksnya. Halaman statis tidak
  // punya modal, jadi komponen menampilkan modalnya sendiri — bukan melempar
  // user langsung ke Google tanpa penjelasan.
  function emitLogin(title, msg) {
    title = title || LOGIN_DEFAULT[0];
    msg = msg || LOGIN_DEFAULT[1];
    var ev = new CustomEvent('nanu:login', { cancelable: true, detail: { title: title, msg: msg } });
    document.dispatchEvent(ev);
    if (!ev.defaultPrevented) openLoginModal(title, msg);
  }

  var loginOvl = null;
  function closeLoginModal() { if (loginOvl) { loginOvl.remove(); loginOvl = null; } }

  function openLoginModal(title, msg) {
    if (loginOvl) return;
    loginOvl = document.createElement('div');
    loginOvl.className = 'nnu-ovl';
    loginOvl.innerHTML = '<div class="nnu-modal nnu-modal-c" data-nnu="card">'
      + '<img class="nnu-modal-logo" src="/assets/nanu-logo.png" alt="Nanu">'
      + '<h3>' + esc(title) + '</h3>'
      + '<p>' + esc(msg) + '</p>'
      + '<button class="nnu-google" type="button" data-nnu="google">' + GOOGLE + 'Lanjutkan dengan Google</button>'
      + '<button class="nnu-cancel" type="button" data-nnu="cancel">Nanti saja</button>'
      + '</div>';
    document.body.appendChild(loginOvl);
    loginOvl.onclick = closeLoginModal;
    loginOvl.querySelector('[data-nnu="card"]').onclick = function (e) { e.stopPropagation(); };
    loginOvl.querySelector('[data-nnu="cancel"]').onclick = closeLoginModal;
    loginOvl.querySelector('[data-nnu="google"]').onclick = loginDirect;
  }

  function loginDirect() {
    supabase().then(function (m) {
      var u = new URL(window.location.href);
      ['error', 'error_description', 'order_id', 'status_code', 'transaction_status', 'sb'].forEach(function (k) { u.searchParams.delete(k); });
      u.hash = '';
      m.signInWithGoogle(u.origin + u.pathname + u.search);
    }).catch(function () {});
  }

  function logout() {
    // Halaman boleh menentukan tujuan setelah logout lewat <nanu-navbar logout-href="/">.
    // Mis. /daftar-nama: reload di sana berarti generate nama baru (dan memakai jatah),
    // padahal daftarnya memang tidak disimpan — jadi user dibawa ke beranda.
    var dest = null;
    navbars.forEach(function (el) { if (!dest) dest = el.getAttribute('logout-href'); });
    clearCache();
    queueToast('Kamu telah keluar'); // halaman berpindah, jadi toast ditampilkan setelahnya
    supabase().then(function (m) { return m.signOut(); })
      .catch(function () {})
      .then(function () {
        if (dest) window.location.href = dest;
        else window.location.reload();
      });
  }

  function goSaved() {
    if (user) { window.location.href = '/nama-tersimpan'; return; }
    emitLogin('Masuk untuk lihat nama tersimpan', 'Koleksi nama favoritmu tersimpan aman di akunmu dan bisa diakses dari perangkat mana pun.');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'nnu-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ---------------------------------------------------------------- navbar
  function navbarHtml() {
    var right;
    if (!user) {
      right = '<button class="nnu-signin" type="button" data-nnu="login">Masuk</button>';
    } else {
      var ava = user.picture
        ? '<div class="nnu-ava" style="background-image:url(&quot;' + esc(user.picture) + '&quot;)"></div>'
        : '<div class="nnu-ava-i">' + esc(user.initial || '?') + '</div>';
      var avaLg = user.picture
        ? '<div class="nnu-ava-lg" style="background-image:url(&quot;' + esc(user.picture) + '&quot;)"></div>'
        : '<div class="nnu-ava-lg-i">' + esc(user.initial || '?') + '</div>';
      var crown = premium ? '<div class="nnu-crown" title="Premium">' + CROWN + '</div>' : '';
      var pill = premium ? '<div class="nnu-pill">' + CROWN_SM + 'Premium</div>' : '';
      // Menu SELALU ada di DOM; buka/tutup hanya meng-toggle display (lihat setMenu).
      // Membangun ulang innerHTML saat hover membuat elemen di bawah kursor dibuat
      // ulang → mouseenter menyala lagi → loop, dan tombol hancur sebelum 'click'.
      var menu = '<div class="nnu-menu" style="display:' + (menuOpen ? 'block' : 'none') + '"><div class="nnu-menu-card">'
        + '<div class="nnu-me">' + avaLg
        + '<div style="min-width:0"><div class="nnu-name">' + esc(user.name || '') + '</div>'
        + '<div class="nnu-email">' + esc(user.email || '') + '</div>' + pill + '</div></div>'
        + '<button class="nnu-logout" type="button" data-nnu="logout">' + EXIT + 'Keluar</button>'
        + '</div></div>';
      right = '<div class="nnu-ava-wrap" data-nnu="avawrap">'
        + '<button class="nnu-ava-btn" type="button" data-nnu="menu" title="' + esc(user.name || '') + '">' + ava + '</button>'
        + crown + menu + '</div>';
    }

    var badge = savedCount > 0 ? '<span class="nnu-badge">' + savedCount + '</span>' : '';
    return '<header class="nnu-nav"><div class="nnu-nav-in">'
      + '<a class="nnu-logo" href="/" title="Beranda"><img src="/assets/nanu-logo.png" alt="Nanu"></a>'
      + '<nav class="nnu-links">'
      + '<button class="nnu-saved" type="button" data-nnu="saved">Tersimpan' + badge + '</button>'
      + right
      + '</nav></div></header>';
  }

  // Buka/tutup dropdown TANPA membangun ulang navbar (lihat catatan di navbarHtml).
  function setMenu(open) {
    if (menuOpen === open) return;
    menuOpen = open;
    navbars.forEach(function (el) {
      var m = el.querySelector('.nnu-menu');
      if (m) m.style.display = open ? 'block' : 'none';
    });
  }

  function bindNavbar(el) {
    el.querySelectorAll('[data-nnu]').forEach(function (n) {
      var a = n.getAttribute('data-nnu');
      // Jangan `n.onclick = emitLogin`: MouseEvent akan terkirim sebagai judul.
      if (a === 'login') n.onclick = function () { emitLogin(); };
      if (a === 'logout') n.onclick = logout;
      if (a === 'saved') n.onclick = goSaved;
      if (a === 'menu') n.onclick = function (e) { e.stopPropagation(); setMenu(!menuOpen); };
      // Hanya di perangkat ber-hover sungguhan. Di layar sentuh browser menyalakan
      // mouseenter tepat sebelum click, sehingga menu terbuka lalu langsung tertutup.
      if (a === 'avawrap' && CAN_HOVER) {
        n.onmouseenter = function () { setMenu(true); };
        n.onmouseleave = function () { setMenu(false); };
      }
    });
  }

  function renderNavbars() {
    navbars.forEach(function (el) { el.innerHTML = navbarHtml(); bindNavbar(el); });
  }

  // ---------------------------------------------------------------- footer
  function footerHtml() {
    return '<footer class="nnu-foot">'
      + '<div class="nnu-foot-links">'
      + '<a href="/privasi">Kebijakan Privasi</a>'
      + '<a href="/ketentuan">Ketentuan Layanan</a>'
      + '<a href="/faq">Tanya Jawab</a>'
      + '<button class="nnu-fb-open" type="button" data-nnu="feedback">Beri masukan</button>'
      + '</div>'
      + '<div class="nnu-copy">© 2026 Nanu · Made with ❤️</div>'
      + '</footer>';
  }

  function renderFooters() {
    footers.forEach(function (el) {
      el.innerHTML = footerHtml();
      var b = el.querySelector('[data-nnu="feedback"]');
      if (b) b.onclick = openFeedback;
    });
  }

  // Buang <a> fallback yang ditempelkan parser setelah footer kita ter-render.
  function dropFallbackLinks() {
    footers.forEach(function (el) {
      var strays = el.querySelectorAll(':scope > a');
      for (var i = 0; i < strays.length; i++) strays[i].remove();
    });
  }

  // ---------------------------------------------------------- modal masukan
  var fbOvl = null;

  function closeFeedback() { if (fbOvl) { fbOvl.remove(); fbOvl = null; } }

  function openFeedback() {
    if (fbOvl) return;
    fbOvl = document.createElement('div');
    fbOvl.className = 'nnu-ovl';
    fbOvl.innerHTML = '<div class="nnu-modal" data-nnu="card">'
      + '<h3>Beri masukan</h3>'
      + '<p>Saran, kritik, atau laporan bug — semuanya kami baca.</p>'
      + '<textarea maxlength="1000" placeholder="Tulis masukanmu di sini…" data-nnu="msg"></textarea>'
      + (user ? '' : '<input type="email" placeholder="Email (opsional, agar kami bisa membalas)" data-nnu="email">')
      + '<input type="text" class="nnu-hp" tabindex="-1" autocomplete="off" data-nnu="hp">'
      + '<button class="nnu-send" type="button" data-nnu="send">Kirim masukan</button>'
      + '<button class="nnu-cancel" type="button" data-nnu="cancel">Nanti saja</button>'
      + '</div>';
    document.body.appendChild(fbOvl);

    fbOvl.onclick = closeFeedback;
    fbOvl.querySelector('[data-nnu="card"]').onclick = function (e) { e.stopPropagation(); };
    fbOvl.querySelector('[data-nnu="cancel"]').onclick = closeFeedback;
    fbOvl.querySelector('[data-nnu="send"]').onclick = sendFeedback;
    fbOvl.querySelector('[data-nnu="msg"]').focus();
  }

  function sendFeedback() {
    var msgEl = fbOvl.querySelector('[data-nnu="msg"]');
    var emailEl = fbOvl.querySelector('[data-nnu="email"]');
    var hpEl = fbOvl.querySelector('[data-nnu="hp"]');
    var btn = fbOvl.querySelector('[data-nnu="send"]');
    var message = (msgEl.value || '').trim();
    if (!message) { msgEl.focus(); return; }

    btn.disabled = true;
    btn.textContent = 'Mengirim…';

    var payload = {
      message: message,
      email: emailEl ? (emailEl.value || '').trim() : '',
      hp: hpEl ? hpEl.value : '',
      page: location.pathname,
    };

    var headers = { 'Content-Type': 'application/json' };
    var tokenP = user ? supabase().then(function (m) { return m.getAccessToken(); }).catch(function () { return null; }) : Promise.resolve(null);

    tokenP.then(function (tok) {
      if (tok) headers.Authorization = 'Bearer ' + tok;
      return fetch('/api/feedback', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    }).then(function (r) {
      if (!r.ok) throw new Error('failed');
      closeFeedback();
      toast('Terima kasih! Masukanmu terkirim ✨');
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Kirim masukan';
      toast('Gagal mengirim masukan, coba lagi');
    });
  }

  // ---------------------------------------------------------------- auth
  function loadAuth() {
    supabase().then(function (m) {
      return m.getUser().then(function (u) {
        if (!u) {
          // Tak ada sesi. Bila tadi kita melukis dari ingatan (mis. sesi kedaluwarsa),
          // kembalikan ke keadaan logout.
          clearCache();
          if (user) { user = null; premium = false; savedCount = 0; renderNavbars(); }
          return;
        }
        user = u;
        renderNavbars();
        return Promise.all([
          m.isPremium().catch(function () { return false; }),
          m.fetchSaved().catch(function () { return []; }),
        ]).then(function (res) {
          premium = !!res[0];
          savedCount = (res[1] || []).length;
          writeCache();
          renderNavbars();
        });
      });
    }).catch(function () {});
  }

  // Halaman boleh menyinkronkan state yang mereka ubah sendiri.
  document.addEventListener('nanu:saved', function (e) {
    savedCount = (e.detail && e.detail.count) || 0;
    writeCache();
    renderNavbars();
  });
  document.addEventListener('nanu:premium', function (e) {
    premium = !!(e.detail && e.detail.premium);
    writeCache();
    renderNavbars();
  });
  document.addEventListener('click', function () { setMenu(false); });

  window.NanuChrome = { openFeedback: openFeedback, toast: toast };

  // ---------------------------------------------------------- custom elements
  function define(name, list, render) {
    if (customElements.get(name)) return;
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        injectCss();
        if (list.indexOf(this) === -1) list.push(this);
        render();
      }
      disconnectedCallback() {
        var i = list.indexOf(this);
        if (i > -1) list.splice(i, 1);
      }
    });
  }

  // Script ini dimuat NON-defer di <head>: CSS masuk dan elemen didefinisikan
  // sebelum <body> di-parse, sehingga navbar/footer sudah ter-upgrade pada paint
  // pertama. Dengan defer, sempat terlihat body putih + link fallback biru mentah.
  injectCss();

  // Lukis optimistis dari ingatan agar tidak ada kilatan "Masuk" / badge hilang.
  var cached = readCache();
  if (cached) {
    user = { name: cached.name, email: cached.email, initial: cached.initial, picture: cached.picture };
    premium = !!cached.premium;
    savedCount = cached.savedCount || 0;
  }

  define('nanu-navbar', navbars, renderNavbars);
  define('nanu-footer', footers, renderFooters);

  function onReady() { dropFallbackLinks(); flushToast(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();

  loadAuth();
})();
