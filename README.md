# Sistem Pembayaran Cicilan Tanah

Kerangka Next.js 16 (App Router, TypeScript, Tailwind) + Supabase (Postgres, Auth, Storage), mengikuti PRD versi 1.1.

## Menjalankan

```bash
npm install
cp .env.example .env.local
# isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

`npm run build` sudah diverifikasi lolos.

## Migrasi (Supabase online, tanpa Docker)

Cara paling cepat: buka project Supabase → **SQL Editor** → **New query** → paste seluruh isi `supabase/migrations/20261123000000_init.sql` → **Run**.

Alternatif lewat CLI (tetap tanpa Docker):

```bash
npm run db:link
npm run db:push
```

`db:link` akan meminta login/browser atau database password project (Project Settings → Database). `db push` hanya menerapkan migrasi yang belum tercatat di tabel `supabase_migrations.schema_migrations`. Pilih salah satu antara SQL Editor dan CLI — jangan dua-duanya, karena SQL Editor tidak mengisi tabel catatan migrasi.

Migrasi ini membuat:

- tabel `profiles`, `kavlings`, `opsi_cicilan`, `pemesanan`, `tagihan`, `pembayaran`, `pengaturan`, `log_aktivitas`
- RLS: pembeli hanya membaca data sendiri, admin mengelola data, pemilik hanya membaca
- bucket Storage privat `bukti-transfer`, path: `{user_id}/{pemesanan_id}/{tagihan_id}/{nama_file}`
- RPC `create_pemesanan`, `upload_bukti`, `verifikasi_pembayaran`, `hitung_denda`

Akun yang daftar sendiri otomatis berperan `pembeli`. Untuk membuat admin, daftarkan akun lalu jalankan di SQL Editor:

```sql
update public.profiles set role = 'admin' where id = 'UUID_AKUN';
```

Trigger `guard_profile_role` hanya menolak perubahan role dari pengguna login yang bukan admin. Perubahan lewat SQL Editor/service role (`auth.uid()` null) diizinkan. Proyek yang sudah menjalankan migrasi lama harus memperbarui fungsi ini dulu — salin versi terbaru dari `supabase/migrations/20261123000000_init.sql` ke SQL Editor sebelum menjalankan `update`.

## Tema

Tombol di kanan bawah mengganti terang/gelap dan menyimpan pilihan di `localStorage`. Default saat pertama buka adalah terang.

## Auth & pembatasan peran

- `/register` — daftar; `nama` dan `no_hp` dikirim sebagai metadata dan masuk ke `profiles` lewat trigger `handle_new_user`.
- `/login` — masuk dengan email + kata sandi.
- `/dashboard` — hanya untuk akun login; menampilkan nama, email, dan peran.
- `/admin` — hanya `admin`/`pemilik`; `pembeli` dialihkan ke `/dashboard`.
- Tombol keluar memakai `POST /auth/logout`.

Pemeriksaan peran ada di `src/lib/auth.ts` (`requireUser`, `requireRole`). Kalau project Supabase mengaktifkan konfirmasi email, akun baru harus verifikasi email dulu sebelum bisa masuk.

## Kavling & denah

- `/denah` — denah blok untuk pengguna login; warna menandakan `tersedia`, `dipesan`, `terjual`, dan menampilkan luas + harga.
- `/admin/kavling` — hanya `admin`: tambah/ubah kavling, mengaktifkan atau menonaktifkannya, dan mengatur denda per kavling. Form denda kosong berarti pakai aturan global.

Status kavling tidak diubah dari form; status berubah otomatis lewat alur pemesanan/pembayaran.

## Pemesanan & simulasi cicilan

- `/pesan/[kavlingId]` — pilih Cash atau Cicil. Untuk Cicil, pilih DP/tenor dari `opsi_cicilan` aktif (opsi khusus kavling mengalahkan opsi umum), lalu lihat simulasi DP, sisa pokok, angsuran, dan jadwal sebelum konfirmasi.
- Simulasi mengikuti rumus `create_pemesanan`; angka yang dikunci pesanan tetap dihitung database saat konfirmasi.
- `/pesanan` dan `/pesanan/[id]` — daftar dan detail pesanan beserta tagihan yang dibuat RPC.

Konfirmasi memanggil RPC `create_pemesanan`, sehingga harga/DP/tenor terkunci, status kavling jadi `dipesan`, dan dua pembeli yang memesan kavling sama tidak bisa keduanya berhasil.

## Pembayaran & verifikasi

- `/tagihan/[tagihanId]` — menampilkan rekening dari `pengaturan`, pokok, denda angsuran yang dihitung `hitung_denda` saat dibaca, serta total. Bukti JPG/PNG/PDF maksimal 2 MB diunggah ke bucket privat `bukti-transfer` dengan path `{user_id}/{pemesanan_id}/{tagihan_id}/{nama_file}`.
- `/admin/pembayaran` — antrean bukti untuk admin; tautan bukti memakai signed URL. Tombol **Setujui** atau **Tolak** (wajib alasan) memanggil `verifikasi_pembayaran`.
- RPC mengunci denda saat unggah, mengubah status tagihan/pesanan/kavling, dan menerbitkan nomor kwitansi `KW-0001` dst. Tagihan yang ditolak bisa diunggah ulang.

## Kwitansi PDF

Route `/kwitansi/[pembayaranId]` merender PDF dengan `pdf-lib` dan mengembalikannya sebagai lampiran. Isinya: tanggal verifikasi, nama pembeli, jenis pembayaran, kode pesanan, kavling, luas, harga tanah, harga per m², pokok, denda, dan total. RLS membatasi unduhan ke pembeli pemilik atau staff.

Tautan unduh tersedia di halaman tagihan setelah verifikasi, dan di bagian **Kwitansi terbit** pada `/admin/pembayaran`. Nomor `KW-0001` dst. berasal dari `verifikasi_pembayaran`, jadi tidak ada nomor duplikat.

## Denda per kavling

Kolom di `kavlings`: `denda_persen_per_minggu`, `denda_maks_persen`, `masa_tenggang_hari`. Admin bisa mengubahnya lewat tabel `kavlings` (RLS admin). Nilai `null` berarti memakai nilai global di `pengaturan`, sehingga kavling lama tetap memakai aturan lama sampai diisi sendiri.

`hitung_denda` memakai override kavling bila ada. `upload_bukti` mengunci nominal denda ke `pembayaran.denda` saat bukti diunggah, sehingga perubahan aturan setelahnya tidak mengubah kwitansi yang sudah terbit.

## Status

Semua alur inti PRD fase 1 sudah dibuat: schema + RLS, auth dan pembatasan peran, kelola kavling dan denda per kavling, denah, pemesanan dan simulasi cicilan, unggah bukti, verifikasi pembayaran, serta unduh kwitansi PDF.
## Konvensi commit

Pesan commit mengikuti [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#summary):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Jenis yang dipakai di proyek ini:

- `feat` — fitur baru
- `fix` — perbaikan bug
- `docs` — perubahan dokumentasi
- `refactor` — ubah struktur kode tanpa mengubah perilaku
- `test` — tambah/ubah pengujian
- `chore` — dependency, konfigurasi, dan pekerjaan pendukung lain

Contoh:

```
feat(kavling): tambah form denda per kavling
fix(auth): perbaiki guard peran saat promosi admin lewat SQL Editor
docs: tambahkan panduan migrasi Supabase online
```

Perubahan yang breaking ditandai dengan `!` sebelum titik dua, misalnya `feat(api)!: ganti format argumen create_pemesanan`, atau footer `BREAKING CHANGE: <penjelasan>`.
