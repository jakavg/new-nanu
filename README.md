# Handoff: Nanu — Generator Nama Bayi Bermakna (AI)

## Overview
**Nanu** adalah aplikasi web (responsive) untuk mencari nama bayi bermakna. User memasukkan kata kunci arti, memilih asal bahasa (Jawa Kuno / Sansekerta / Islami), panjang nama, dan jenis kelamin; AI menghasilkan daftar nama beserta makna yang sudah dirangkai. User dapat **menyimpan** nama (wajib login Google) dan **membagikan** ke berbagai channel.

Aplikasi terdiri dari **3 halaman**:
1. **Search** — form pencarian (landing).
2. **Daftar Nama (List)** — hasil generate AI + simpan/bagikan + "muat lebih banyak" + filter melayang.
3. **Nama Tersimpan (Saved)** — koleksi nama per akun (butuh login).

## About the Design Files
File dalam bundel ini (`*.dc.html`, `*.js`) adalah **referensi desain yang dibuat dalam HTML** — prototipe yang menunjukkan tampilan & perilaku yang diinginkan, **bukan kode produksi untuk disalin langsung**. Tugasnya adalah **membangun ulang desain ini di lingkungan codebase target** (disarankan **React + Vite** atau **Next.js**, karena UI sudah berbasis komponen & state) menggunakan pola dan library yang sudah ada. Jika belum ada codebase, pilih framework yang paling sesuai (rekomendasi: **Next.js + Tailwind + Supabase**) dan implementasikan di sana.

> Catatan: file `.dc.html` memakai runtime internal (tag `<x-dc>`, `<sc-if>`, `<sc-for>`, `support.js`) yang **tidak perlu** dibawa ke produksi. Baca file itu untuk memahami struktur & logika, lalu tulis ulang sebagai komponen biasa.

## Fidelity
**High-fidelity (hifi).** Warna, tipografi, spacing, radius, dan interaksi sudah final. Bangun ulang UI **pixel-perfect** memakai design tokens di bawah. Logika (chain login, fallback AI, persistence) sudah teruji di prototipe dan bisa dijadikan acuan langsung.

---

## Design Tokens

### Warna
| Token | Hex | Pemakaian |
|---|---|---|
| Background utama | `#F9EFEB` | latar halaman (krem hangat) |
| Surface / kartu | `#FFFFFF` | kartu, modal, input aktif |
| Surface lembut | `#FCF7F4` | input default, tombol ikon |
| Teks utama | `#0B2A3A` | judul & teks utama (navy gelap) |
| Teks sekunder | `#5C6B72` | paragraf, deskripsi |
| Teks muted | `#8A969C` / `#A9B3B8` | placeholder, hint, caption |
| Border | `#EDE2DC` | garis kartu/input |
| Border muted | `#DCCFC8` | border dashed (empty state) |
| **Aksen merah** (primary CTA list) | `#EE5B3A` | tombol utama, badge, hati tersimpan |
| **Aksen hijau** | `#3CA274` | aksen "bermakna", asal Jawa, avatar default, CTA search |
| **Aksen biru** | `#185FA4` | asal Sansekerta, gender, aksen sekunder |
| **Aksen kuning** | `#F6BE2D` | asal Islami |
| Merah gelap (hover/teks) | `#E0492A` | teks badge merah |

Catatan: warna mengikuti palet brand Nanu (logo memakai biru/merah/kuning/hijau ceria). Latar krem `#F9EFEB` + navy `#0B2A3A` adalah netral dasar. Maksimal 1–2 warna latar; aksen dipakai untuk variasi ritme.

#### Avatar/badge inisial nama (rotasi 6 warna, by index)
```
[ {bg:#FDEAE4, fg:#E0492A}, {bg:#FFF3D2, fg:#C98A00}, {bg:#E2F2EA, fg:#2E8B5E},
  {bg:#E6F0FA, fg:#185FA4}, {bg:#FCE9E7, fg:#D86A5A}, {bg:#EAF3FC, fg:#3E7CB1} ]
```

### Tipografi
- **Display / judul / nama / tombol utama**: `'Baloo 2'` (Google Fonts), weight 500–800, rounded & hangat. `letter-spacing: -0.01em` pada heading.
- **Teks UI / body**: `'Plus Jakarta Sans'` (Google Fonts), weight 400–700.
- Skala judul: H1 `clamp(30px, 6vw, 46px)` line-height 1.08; H2 `clamp(24px, 4.5vw, 32px)` / `clamp(26px, 5vw, 36px)`; nama kartu `clamp(20px, 3.4vw, 24px)`.
- Body 14.5–16px; caption 12–13px.

### Spacing & bentuk
- Lebar konten maks: **720px** (header inner 880px), `margin: 0 auto`, padding horizontal 20px.
- Radius: input 13–15px; kartu 20px; kartu besar/modal 24–26px; pill 999px; tombol ikon 12px; avatar 50%.
- Shadow kartu: `0 1px 2px rgba(11,42,58,.04)`.
- Shadow elevasi (modal/popover): `0 18px 44px -16px rgba(11,42,58,.4)`, `0 30px 70px -20px rgba(11,42,58,.4)`.
- Shadow tombol CTA: `0 12px 26px -12px <warna>`.

### Keyframes / animasi
- `nanuSpin`: rotate 360° (spinner loading), 0.8s linear infinite.
- `nanuPop`: `translateY(16px) scale(.98)` → normal (modal/popover masuk), ~0.28s cubic-bezier(.2,.8,.3,1).
- `nanuToast`: `translate(-50%,16px)` → `translate(-50%,0)` (toast).
- `nanuBob`: naik-turun 6px (ikon empty state), 3s ease-in-out infinite.
- Hover CTA: `filter:brightness(1.05); transform:translateY(-1px)`. Hover ikon share/save: ganti `border-color`. Hover chip share: `translateY(-2px)`.

---

## Screens / Views

### 1. Search (landing) — `Nanu.dc.html`
**Purpose**: user menyusun kriteria lalu memulai pencarian.

**Layout**: header sticky (logo kiri, nav kanan) → konten tengah maks 720px: H1 dua baris, lalu kartu putih berisi form, lalu chip "kata kunci populer".

**Komponen**:
- **Header** (sticky, `background: rgba(249,239,235,.86)` + `backdrop-filter: blur(10px)`, border-bottom `#EDE2DC`): logo Nanu (tinggi 42px, link ke beranda) + nav.
  - Nav saat **logout**: tombol "Tersimpan" + tombol "Masuk" (pill navy `#0B2A3A`, teks putih).
  - Nav saat **login**: tombol "Tersimpan" (+ badge merah jumlah koleksi bila ada) + **avatar** (foto Google atau lingkaran inisial hijau `#3CA274`).
- **H1**: "Cari nama **bermakna** untuk **si kecil**" — kata "bermakna" hijau `#3CA274`, "si kecil" merah `#EE5B3A`, font Baloo 2 700.
- **Kartu form** (putih, radius 26px, border `#EDE2DC`, shadow `0 18px 50px -28px rgba(11,42,58,.3)`):
  - **Input kata kunci** (opsional) dengan ikon search di kiri. Border 2px `#EDE2DC`, bg `#FCF7F4`; focus → border `#3CA274` + bg putih. Placeholder: "mis. cahaya, keberanian, kebijaksanaan".
  - **Asal nama** — 3 kartu pilih (grid auto-fit minmax 150px): Jawa Kuno (dot hijau, "Klasik & berwibawa"), Sansekerta (dot biru, "Agung & filosofis"), Islami (dot kuning, "Penuh berkah"). Kartu aktif: border 2px warna aksen + shadow berwarna.
  - **Panjang nama** — pill: "2 Kata" / "3 Kata" (aktif = hijau `#3CA274` solid, teks putih).
  - **Jenis kelamin** — pill: "Laki-laki" / "Perempuan" (aktif = biru `#185FA4` solid). *(Tidak ada opsi "Netral".)*
  - **Tombol CTA** "Carikan Nama" — full width, hijau `#3CA274` (warna bisa di-tweak), Baloo 2 700, 18px, radius 16px. **Saat diklik**: langsung berubah jadi spinner + "Mencari nama…" lalu pindah ke halaman list (lihat Interactions).
- **Chip kata kunci populer**: Cahaya, Keberanian, Kebijaksanaan, Cinta kasih, Bintang, Anugerah — klik mengisi input. (Bisa disembunyikan via prop `showExamples`.)

### 2. Daftar Nama (List) — `Daftar-Nama.dc.html`
**Purpose**: menampilkan hasil generate AI; user simpan/bagikan; ubah filter tanpa kembali ke beranda.

**Layout**: header (sama) → konten 720px: link "← Ubah pencarian", H2 "Rangkaian nama untukmu", baris chip filter (arti/asal/panjang/gender), lalu state loading **atau** error **atau** daftar kartu + tombol "Muat lebih banyak". **Filter melayang** fixed di tengah-bawah.

**Komponen**:
- **Chip ringkasan**: bila ada kata kunci → "arti <kw>"; lalu asal, "N kata", gender.
- **Loading state**: spinner `nanuSpin` (46px, border-top merah `#EE5B3A`) + "Meramu nama bermakna…" + "Nanu sedang merangkai arti tiap kata".
- **Error state**: kartu putih border `#F3ABA3`, pesan merah + tombol "Coba lagi".
- **Kartu nama** (putih, radius 20px, flex): kiri = badge inisial 54px (warna rotasi by index), tengah = **nama** (Baloo 2 700, baris 1) + **makna** (`#5C6B72`, 14.5px, baris 2), kanan = 2 tombol ikon vertikal:
  - **Simpan** (hati): kosong = outline navy; tersimpan = isi merah `#EE5B3A`. Hover border merah.
  - **Bagikan**: ikon share, buka share modal. Hover border biru.
- **Tombol "Muat lebih banyak"**: outline pill, hover hijau. Menambah nama baru (dedup, tidak mengganti yang lama). **Butuh login** — bila belum login, buka login modal; setelah login lanjut otomatis.
- **Filter melayang** (fixed bottom center, lebar `min(680px, 100% - 24px)`, z-index 50): pill navy berisi ringkasan filter + chevron. Diklik → panel putih (radius 22px) berisi input kata kunci, 3 kartu asal, pill panjang & gender, dan tombol "Perbarui" (merah) yang regenerate + update URL query.

### 3. Nama Tersimpan (Saved) — `Nama-Tersimpan.dc.html`
**Purpose**: koleksi nama favorit per akun.

**Layout**: header (nav: link "Cari nama" + avatar/Masuk) → 720px: H2 "Nama Tersimpan" + subjudul, lalu salah satu dari: **locked** (belum login), **empty**, atau **daftar**.
- **Locked**: kartu dashed, ikon gembok biru, "Masuk untuk melihat koleksi" + tombol "Masuk dengan Google". Login modal otomatis terbuka saat halaman dibuka tanpa sesi.
- **Empty**: kartu dashed, ikon hati merah (animasi `nanuBob`), "Belum ada nama tersimpan" + tombol "Mulai cari nama" (link ke Search).
- **Daftar**: kartu nama sama seperti List, tapi tombol kanan = **Bagikan** + **Hapus** (ikon tong sampah merah; hover bg `#FDEAE4`).

---

## Interactions & Behavior

### Navigasi antarhalaman
- Logo → Search. "Tersimpan"/"Cari nama" → halaman terkait.
- Search "Carikan Nama": simpan kriteria, **set state `searching` (spinner + "Mencari nama…") langsung**, lalu setelah ~120ms pindah ke List dengan query string `?origin=&length=&gender=&keyword=`. (Delay singkat agar UI sempat repaint sebelum navigasi penuh — beri feedback instan; di SPA cukup pakai router push + loading state, tanpa delay.)
- List membaca kriteria dari **URL query**, fallback ke `localStorage('nanu_query')`. Validasi: origin ∈ {jawa,sansekerta,islami}, length ∈ {2,3}, gender ∈ {lk,pr}.

### Generate AI (saat ini Claude saja)
- Prompt meminta **N nama** (default 5; prop `resultsCount` 4–8) jenis kelamin terpilih, **tepat 2/3 kata**, dari bahasa terpilih (Jawa Kuno (Kawi) / Sansekerta / Arab-Islami), makna terkait kata kunci (jika ada). Tiap nama: rangkai arti tiap kata jadi **satu kalimat makna** Bahasa Indonesia. Balas **HANYA JSON array** `[{"name","meaning"}]`.
- "Muat lebih banyak" mengirim daftar nama yang sudah ada agar **tidak diulang** (dedup di client juga).
- Parsing toleran: strip ```json fences, ambil substring dari `[` sampai `]`.
- **Catatan provider**: prototipe sempat memakai chain Gemini→OpenAI→DeepSeek→Claude, lalu **dikembalikan ke Claude saja** sampai development selesai. Di produksi: panggil LLM **dari backend** (jangan ekspos API key di frontend). Simpan key di env var. Struktur chain mudah dihidupkan lagi.

### Auth (login Google)
- Lihat `nanu-auth.js` (Google Identity Services) — prototipe. Tombol Google resmi dirender; ada link "mode demo" untuk uji coba tanpa origin terdaftar.
- **Untuk produksi disarankan pakai Supabase Auth** (lihat `nanu-supabase.js`): `signInWithOAuth({provider:'google'})`. Profil → `{id, name, email, initial, picture}`.
- **Gate**: aksi Simpan & "Muat lebih banyak" butuh login → buka modal; setelah login, aksi yang tertunda (`pendingSave` / `pendingLoadMore`) otomatis dijalankan. Saved page redirect/terkunci bila belum login.
- **Avatar popover**: hover (atau klik) avatar di header → popover (radius 16px) berisi avatar + nama + email + tombol "Keluar". Tidak ada tombol "Keluar" terpisah di navbar. Implementasi prototipe pakai state `menuOpen` + onMouseEnter/Leave; container popover punya `padding-top:10px` sebagai jembatan agar hover tidak putus.

### Share
- Bottom-sheet modal (radius atas 26px, animasi `nanuPop`). Menampilkan "<nama> — <makna>". 4 channel: **WhatsApp** (`https://wa.me/?text=`), **Instagram** (salin teks + toast "tempel di Instagram"), **Facebook** (`facebook.com/sharer`), **Salin Tautan** (clipboard + toast). Tiap channel lingkaran 58px berwarna brand.
- Teks share: `"<nama> — <makna> (via Nanu)"` + URL `https://nanu.app/nama/<slug>`.

### Toast
- Pill navy fixed bottom-center, animasi `nanuToast`, auto-hilang ~2.6s. Dipakai untuk: tersimpan/dihapus, status login, hasil share, error muat.

### Loading & responsive
- CTA search → spinner instan (dijelaskan di atas).
- List → loading spinner saat generate; "Muat lebih banyak" → spinner kecil di tombol + teks "Memuat…".
- Semua layout responsive (grid auto-fit, `clamp()` tipografi, `flex-wrap`). Target desktop + mobile.

---

## State Management
**Search**: `keyword, origin('jawa'), length('2'), gender('lk'), saved[], user, showLogin, pendingNav, toast, menuOpen, searching, googleReady`.
**List**: di atas + `loading(true), loadingMore, filterOpen, error, results[], pendingSave, pendingLoadMore, shareTarget`.
**Saved**: `saved[], user, showLogin, shareTarget, toast, menuOpen`.

Transisi kunci: klik Simpan tanpa user → `showLogin=true, pendingSave=item`; login sukses → jalankan pending; klik "Muat lebih banyak" tanpa user → `showLogin=true, pendingLoadMore=true`.

### Persistence (prototipe → ganti dengan backend)
- `localStorage`: `nanu_user` (profil), `nanu_saved` (array `{name, meaning, origin, ts}`), `nanu_query` (kriteria terakhir).
- **Produksi**: ganti `nanu_saved` dengan **tabel Supabase `saved_names`** (per `user_id`, RLS) — lihat `nanu-supabase.js` untuk fungsi `fetchSaved/addSaved/removeSaved` dan SQL di bawah.

### SQL tabel koleksi (Supabase)
```sql
create table if not exists public.saved_names (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  meaning text,
  origin text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.saved_names enable row level security;
create policy "select own" on public.saved_names for select using (auth.uid() = user_id);
create policy "insert own" on public.saved_names for insert with check (auth.uid() = user_id);
create policy "delete own" on public.saved_names for delete using (auth.uid() = user_id);
```
Dashboard Supabase: aktifkan provider Google (paste Google Client ID + Secret), set Site URL + Redirect URLs ke domain app, dan tambahkan `https://<project-ref>.supabase.co/auth/v1/callback` ke Authorized redirect URIs di Google Cloud Console.

---

## Assets
- `assets/nanu-logo.png` — logo Nanu (wordmark warna-warni). Dipakai di header (tinggi 42px) dan modal login (tinggi 30px). Gunakan SVG bila tersedia untuk ketajaman.
- Semua ikon lain = **inline SVG** (search, hati, share, trash, chevron, hamburger, gembok, logout, logo provider Google/WhatsApp/Instagram/Facebook). Boleh diganti dengan icon library codebase.
- Font: Google Fonts **Baloo 2** + **Plus Jakarta Sans**.

## Files (referensi desain di bundel ini)
- `Nanu.dc.html` — halaman Search.
- `Daftar-Nama.dc.html` — halaman Daftar Nama (List) + logika generate AI, save/share, load-more, filter.
- `Nama-Tersimpan.dc.html` — halaman Nama Tersimpan (Saved).
- `nanu-auth.js` — helper Google Identity Services (prototipe auth).
- `nanu-supabase.js` — helper Supabase (Auth Google + tabel `saved_names`), berisi langkah setup & API.
- `assets/nanu-logo.png` — logo.

> Logika di file `.dc.html` ada di blok `<script type="text/x-dc">` (class `Component`). `renderVals()` = data yang dipakai template; sisanya = handler/state. Baca itu untuk perilaku persis, lalu tulis ulang sebagai komponen framework target.

## Rekomendasi implementasi
1. **Stack**: Next.js (App Router) + Tailwind + Supabase (Auth + DB). Atau React+Vite bila SPA.
2. **Routing**: `/` (Search), `/nama` (List, baca query params), `/tersimpan` (Saved, protected).
3. **AI**: route handler/server action memanggil LLM (Claude/Gemini) memakai key dari env — jangan di client.
4. Bangun komponen reusable: `Header` (+avatar popover), `NameCard`, `ShareSheet`, `LoginModal`, `FloatingFilter`, `Toast`.
5. Terapkan design tokens di atas sebagai konfigurasi Tailwind (warna, font, radius, shadow).
