# Rak Baca

Pembaca PDF dan EPUB dengan rak buku 3D yang melayang di perpustakaan putih, halaman yang melengkung seperti kertas, dan posisi baca yang tersinkron antara HP dan laptop.

- **Laptop:** buka di browser lewat GitHub Pages.
- **HP Android:** instal `RakBaca.apk` dari halaman Releases.
- **Sinkron:** akun di Supabase (gratis). Buku, sampul, dan halaman terakhir tersimpan di sana.

## Isi folder

| Path | Isi |
|---|---|
| `web/` | Aplikasinya (satu `index.html`), `config.js`, manifest, service worker, ikon |
| `supabase/setup.sql` | Tabel, bucket file, dan aturan akses. Jalankan sekali di Supabase |
| `assets/` | Ikon dan splash untuk APK |
| `.github/workflows/build-apk.yml` | Build APK otomatis setiap ada push ke `main` |
| `.github/workflows/deploy-web.yml` | Publikasi `web/` ke GitHub Pages |
| `keystore/` | Kunci tanda tangan APK. **Jangan di-commit** (sudah di `.gitignore`) |

## Setup sekali

### 1. Supabase
1. Buat project di [supabase.com](https://supabase.com) (paket Free).
2. **SQL Editor → New query**: tempel isi `supabase/setup.sql`, lalu **Run**.
3. **Authentication → Sign In / Providers → Email**: matikan **Confirm email** supaya bisa langsung masuk setelah daftar. Boleh tetap dinyalakan; kalau begitu, klik tautan di email konfirmasi dulu.
4. **Project Settings → API**: salin **Project URL** dan **anon public key** ke `web/config.js`.

### 2. GitHub
1. Buat repo baru, misalnya `rak-baca`. Repo harus **Public** supaya GitHub Pages gratis.
2. Push folder `app/` ini ke branch `main`.
3. **Settings → Pages → Source: GitHub Actions**.
4. **Settings → Secrets and variables → Actions → New repository secret**:
   - `KEYSTORE_B64`: isi `keystore/KEYSTORE_B64.txt`
   - `KEYSTORE_PASSWORD`: isi `keystore/KEYSTORE_PASSWORD.txt`

   Tanpa dua secret ini APK tetap dibuat, tapi setiap versi baru harus di-uninstall dulu sebelum diinstal.
5. Buka tab **Actions** dan tunggu dua workflow selesai (sekitar 5–8 menit).

### 3. Pasang
- **Laptop:** buka `https://<username>.github.io/rak-baca/`. Di Chrome/Edge bisa juga diinstal lewat ikon "Install" di address bar.
- **HP:** buka **Releases** di repo, unduh `RakBaca.apk`, buka file-nya, lalu izinkan "Instal dari sumber ini".

Masuk dengan email dan kata sandi yang sama di HP dan laptop.

## Mengembangkan

```bash
npm install
npm run vendor   # salin pdf.js, JSZip, supabase-js ke web/vendor
npm run serve    # http://localhost:5173
```

Setiap push ke `main` membangun ulang APK dan memperbarui web.
