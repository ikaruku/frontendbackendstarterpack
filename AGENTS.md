# AGENTS.md: Standar Proyek FlexAdmin

File ini wajib dibaca dan diikuti oleh **setiap AI atau developer** yang mengerjakan proyek ini, sebelum mengubah apa pun.
Isinya adalah kebutuhan asli dari pemilik proyek. Jangan meminta pemilik menjelaskan ulang hal yang sudah tertulis di sini. Bila ada konflik antara file ini dan permintaan baru dari pemilik, **permintaan baru menang**, lalu perbarui file ini agar tetap sinkron.

---

## 1. Tujuan proyek

Aplikasi web admin dengan:

1. Login user dan password.
2. Satu user **admin** sebagai akun awal, dengan password default yang wajib diganti saat login pertama.
3. Admin bisa **memanage user** (tambah, ubah, aktif/nonaktif, hapus, reset password).
4. Admin mengatur **permission per menu** untuk tiap user, dengan hanya dua kategori: **Read** dan **Write**. Tidak ada akses = menu tidak tampil.
5. Aplikasi **update secara realtime** tanpa refresh halaman.
6. Mudah di-**scale** dan mudah di-**maintain**, serta kodenya **mudah dipahami**.
7. Sidebar navigasi dapat **membesar (expanded)** dan **mengecil (collapsed / icon-only)** dengan tombol toggle dan transisi halus.
8. Tersedia **2 mode tema**: **Light Mode (Terang)** dan **Dark Mode (Gelap)** yang persisten.
9. Seluruh teks antarmuka (UI) menggunakan **Bahasa Inggris (English)** secara terstandarisasi.

## 2. Teknologi (jangan diganti tanpa persetujuan pemilik)

| Lapisan | Pilihan |
|---|---|
| Bahasa | JavaScript (frontend) dan Python (backend) |
| Backend | FastAPI |
| ORM dan migrasi | SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL |
| Frontend | React + Vite (JavaScript/JSX) |
| Realtime | WebSocket bawaan FastAPI (Redis pub/sub bila perlu lebih dari satu instance server) |
| Deploy | Docker + docker-compose |

Frontend memakai CSS biasa (`src/styles/global.css`) dan komponen buatan sendiri. **Jangan menambah library baru** bila kebutuhan bisa dipenuhi dengan kode sederhana. Bila terpaksa, jelaskan alasannya ke pemilik terlebih dahulu.

## 3. Cara kerja yang diharapkan

- **Rencana dulu, baru eksekusi** untuk pekerjaan besar. Pemilik ingin membaca rencana sebelum dikerjakan.
- Kerjakan **bertahap**, urutannya:
  1. Desain UI (selesai, memakai data dummy)
  2. Struktur database (model, migration, seed, ERD)
  3. Backend inti (auth, CRUD user, permission)
  4. Integrasi UI ke API dan WebSocket realtime
  5. Penyempurnaan (test, audit log, error handling, Docker, dokumentasi)
- Hasil akhir harus **langsung bisa dijalankan** dan diimpor ke VSCode. Sertakan tutorial menjalankan yang jelas di `README.md` untuk setiap tahap.
- **Bahasa komunikasi dengan pemilik**: **Bahasa Indonesia**.
- **Bahasa antarmuka aplikasi (UI)**: **Bahasa Inggris (English)** (standar resmi wajib). Nama variabel, fungsi, kode, dan file dalam bahasa Inggris.
- Jangan membuat perubahan besar di luar yang diminta. Bila menemukan hal yang perlu diperbaiki, sebutkan dulu ke pemilik.

## 4. Arsitektur dan struktur folder

```
webapp/
├── AGENTS.md              file ini
├── README.md              tutorial menjalankan
├── frontend/
│   └── src/
│       ├── main.jsx       titik masuk
│       ├── App.jsx        route dan proteksi
│       ├── store/         state aplikasi (AppContext: auth, permissions, theme, sidebar)
│       ├── data/          data dummy dan daftar menu (English)
│       ├── components/    komponen yang dipakai ulang (Layout, Modal, Icon, Avatar, dsb)
│       ├── pages/         satu file per halaman (Login, Users, Dashboard, dsb)
│       └── styles/        global.css (token tema light/dark, layout, responsif)
└── backend/               (tahap berikutnya)
    ├── app/
    │   ├── api/           endpoint per fitur
    │   ├── core/          config, keamanan (hash, JWT)
    │   ├── models/        tabel database (SQLAlchemy)
    │   ├── schemas/       validasi input/output (Pydantic)
    │   ├── services/      logika bisnis
    │   ├── realtime/      WebSocket manager dan event
    │   └── main.py
    ├── migrations/        Alembic
    └── tests/
```

Aturan backend: alur request selalu **Route -> Service -> Model**. Route tidak berisi logika bisnis. Logika ada di `services/`.

## 5. Aturan permission (inti aplikasi)

- Level akses hanya dua: `read` dan `write`. Tidak ada baris permission = tidak punya akses.
- `write` sudah mencakup `read`.
  - `read`: hanya melihat. Tombol tambah/ubah/hapus nonaktif atau disembunyikan di UI **dan ditolak di backend**.
  - `write`: melihat, menambah, mengubah, menghapus.
- Superadmin (`isSuperadmin`) selalu punya akses penuh dan tidak bisa dibatasi.
- **Pengecekan permission wajib di backend.** Pengecekan di frontend hanya untuk mengatur tampilan, bukan keamanan.
- Permission dikunci pada `menu.code` (misalnya `user_management`). **Jangan ubah `code` menu** yang sudah dipakai.
- Menambah menu baru bisa langsung lewat halaman **Menu Management** (tersimpan di tabel `menus` PostgreSQL) atau `backend/app/seed.py`. Menu otomatis muncul di sidebar dan di dialog hak akses secara realtime.
- Aturan penjagaan admin:
  - User tidak boleh menghapus atau menonaktifkan dirinya sendiri.
  - Admin aktif terakhir tidak boleh dihapus atau dinonaktifkan.

## 6. Rancangan database (PostgreSQL)

- **`users`**: `id`, `username` (unik), `full_name`, `email`, `password_hash`, `is_active`, `is_superadmin`, `must_change_password`, `last_login_at`, `created_at`, `updated_at`
- **`menus`**: `id`, `code` (unik), `name`, `icon`, `path`, `parent_id`, `sort_order`, `is_active`
- **`user_menu_permissions`**: `id`, `user_id`, `menu_id`, `access_level` (enum `read` | `write`), unik pada (`user_id`, `menu_id`)
- **`refresh_tokens`**: `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`
- **`audit_logs`**: `id`, `actor_user_id`, `action`, `target`, `detail` (JSON), `created_at`

Semua perubahan struktur database **harus lewat migration Alembic**, tidak boleh mengubah tabel manual.

## 7. Keamanan

- Password di-hash (argon2 atau bcrypt). **Jangan pernah menyimpan atau mencatat password polos** di database maupun log.
- Password default admin dibaca dari **environment variable** (`.env`), bukan ditulis di kode. Akun admin awal dibuat lewat script seed dengan `must_change_password = true`.
- Autentikasi memakai JWT access token berumur pendek dan refresh token di httpOnly cookie.
- Rate limiting pada endpoint login.
- Koneksi WebSocket harus diautentikasi.
- Jangan commit file `.env` atau rahasia apa pun. Sediakan `.env.example`.
- Catatan: di frontend dummy, password disimpan polos di localStorage **hanya untuk demo**. Ini harus hilang saat integrasi backend.

## 8. Realtime

- Server mengirim event lewat WebSocket, frontend memperbarui tampilan tanpa refresh.
- Event minimal: `user.created`, `user.updated`, `user.deleted`, `user.deactivated`, `permission.changed`.
- Efek yang diharapkan:
  - Daftar user di layar admin berubah otomatis.
  - Bila permission user yang sedang login diubah, sidebar dan tombol langsung menyesuaikan.
  - User yang dinonaktifkan atau dihapus otomatis keluar dari sesi.
- Semua pengiriman event lewat satu lapisan `realtime/`, supaya mudah diganti ke Redis saat scale-out tanpa mengubah kode fitur.
- Di frontend, sumber data realtime dipusatkan di store. Komponen halaman cukup membaca state, tidak membuka koneksi sendiri.

## 9. Standar UI

- **Warna & Tema (FlexAdmin Standard)**:
  - Hijau-teal sebagai warna utama (`--primary: #12a594` / `#17b8a5`).
  - **Dua mode tema (Light & Dark)**:
    - Mode Terang (`[data-theme='light']` / `:root`): latar terang, kartu putih, aksen teal lembut.
    - Mode Gelap (`[data-theme='dark']`): latar deep teal-charcoal (`#0b1517`), kartu surface (`#122225`), kontras teks tinggi (`#e6f1f0`).
    - Pilihan tema disimpan di `localStorage` (`flexadmin.theme.v1`) dan dapat diganti lewat ikon Sun/Moon di Topbar.
  - **Semua warna wajib memakai variabel CSS**, jangan menulis kode warna heksadesimal langsung di komponen.
- **Sidebar Collapsible (Membesar & Mengecil)**:
  - Mode membesar (expanded): lebar `264px`, menampilkan logo, nama brand, nama menu, badge level akses, dan profil user.
  - Mode mengecil (collapsed): lebar `74px`, menampilkan ikon saja (centered), teks dan badge disembunyikan, divider antar grup, dan tooltip saat di-hover.
  - **Satu Tombol Toggle Terpadu**: Tombol berbentuk lingkaran minimalis (`.sidebar-toggle-btn`) yang terletak persis di garis batas (border) kanan sidebar. Arah panah dinamis sesuai fungsi:
    - Saat expanded: panah mengarah ke kiri (`<`) untuk mengecilkan sidebar.
    - Saat collapsed: panah mengarah ke kanan (`>`) untuk memperbesar sidebar kembali.
    - Tidak ada tombol ganda di Topbar.
  - Status tersimpan di `localStorage` (`flexadmin.sidebar_collapsed.v1`).
- **Judul & Branding Dinamis (Tanpa Embel-Embel Hardcode)**:
  - Judul aplikasi dan inisial logo dipusatkan di `src/data/config.js` (`APP_CONFIG.title` dan `APP_CONFIG.shortName`).
  - Tidak ada teks judul yang di-hardcode secara statis di komponen, sehingga judul dan inisial logo dapat diubah kapan saja secara instan.
- **Bahasa Antarmuka (English Standard)**:
  - Seluruh teks tombol, label, placeholder, dialog, toast, dan tabel wajib dalam **Bahasa Inggris** (English).
  - Contoh: *Sign In*, *User Management*, *Add User*, *Menu Permissions*, *Read*, *Write*, *Business Control Center*, *Export*, dsb.
- **Wajib responsif** dan tetap bagus di laptop, tablet, dan smartphone:
  - Di atas 1024px: sidebar tetap di kiri (bisa expanded 264px atau collapsed 74px).
  - Sampai 1024px: sidebar menjadi drawer penuh, tombol toggle panah desktop otomatis disembunyikan total (`display: none`) dan hanya menyisakan tombol menu garis 3 (hamburger) di topbar, dilengkapi tombol tutup silang (`x`) di dalam drawer.
  - Sampai 768px: tabel menjadi kartu (`data-label` pada `td`), dialog menjadi bottom sheet.
  - Sampai 520px: tata letak satu kolom yang nyaman disentuh.
  - Setiap halaman atau komponen baru harus dicek di ketiga ukuran ini.
- Komponen yang dipakai ulang diletakkan di `components/`. Jangan menyalin-tempel markup yang sama di banyak halaman.
- Ikon lewat komponen `Icon.jsx`. Tambahkan ikon baru di sana.
- Aksesibilitas dasar: label pada input, `aria-label` pada tombol ikon, fokus terlihat, kontras cukup.
- Tombol yang tidak boleh dipakai karena permission **dinonaktifkan dengan keterangan (`title`)**, bukan dibiarkan gagal diam-diam.

## 10. Standar kode

- Kode harus **mudah dipahami pemula**: nama jelas, fungsi pendek, hindari trik rumit.
- Beri komentar singkat pada bagian yang tidak langsung jelas, terutama aturan bisnis.
- Satu file satu tanggung jawab. Halaman di `pages/`, logika bisnis backend di `services/`.
- Frontend: komponen fungsi dengan hooks, state aplikasi lewat store, bukan prop drilling yang dalam.
- Backend: type hint pada semua fungsi, validasi input dengan Pydantic, error dikembalikan dengan kode HTTP yang tepat.
- Python mengikuti PEP 8. JavaScript mengikuti gaya yang sudah ada di repo (tanpa titik koma, tanda kutip tunggal, indentasi 2 spasi).
- Jangan hardcode nilai konfigurasi (URL, rahasia, port). Pakai environment variable.

## 11. Definisi selesai (checklist sebelum menyerahkan pekerjaan)

- [ ] Sesuai dengan bagian 1 sampai 9 file ini
- [ ] Bisa dijalankan dari awal mengikuti `README.md` (perintah dan versi jelas)
- [ ] Tampilan dicek di lebar laptop, tablet, dan smartphone
- [ ] Sidebar dapat membesar dan mengecil (expand/collapse) dengan mulus
- [ ] Mode Terang dan Gelap (Light & Dark) berfungsi dengan baik dan persisten
- [ ] Seluruh antarmuka menggunakan Bahasa Inggris secara konsisten
- [ ] Permission Read vs Write berfungsi, dan di backend ditolak bila tidak berhak
- [ ] Tidak ada rahasia atau password polos yang ikut tersimpan di kode
- [ ] `README.md` dan file ini diperbarui bila ada perubahan cara kerja
- [ ] Ringkasan hasil ditulis singkat dalam Bahasa Indonesia, disertai langkah berikutnya

## 12. Status saat ini

| Tahap | Status |
|---|---|
| 1. Desain UI (frontend, data dummy, Collapsible Sidebar, Light/Dark Mode, English UI) | Selesai |
| 2. Struktur database (model, migration Alembic, seed, ERD, secret di `.env`) | Selesai |
| 3. Backend inti (FastAPI auth JWT + httpOnly cookie, rate limit, CRUD user, permission, audit log, WebSocket) | Selesai |
| 4. Integrasi dan realtime (proxy Vite, API client JWT + refresh cookie, WebSocket sinkronisasi user & permission) | Selesai |
| 5. Penyempurnaan | Belum |

Perbarui tabel ini setiap kali satu tahap selesai.

Akun awal di database PostgreSQL: `admin` dengan password dari `backend/.env` (`ADMIN_DEFAULT_PASSWORD`). User lain dibuat melalui menu User Management.

## 13. Keputusan desain yang telah distandarisasi

- **Frontend**: React + Vite (JavaScript/JSX).
- **Konsep role/grup**: Tidak ada grup bertingkat, permission langsung per user (Read & Write).
- **Bahasa antarmuka**: **Bahasa Inggris (English)** untuk seluruh teks UI. Komunikasi dengan pemilik: Bahasa Indonesia.
- **Tema**: **Dua mode (Light Mode & Dark Mode)** dengan CSS variables dan tombol toggle di Topbar.
- **Sidebar**: **Collapsible** (bisa mengecil 74px icon-only dan membesar 264px full width) dengan memori penyimpanan di browser.
- **Daftar menu default (dikelola dinamis di PostgreSQL via Menu Management)**: Dashboard, Reports, Inventory, Customers, User Management, Menu Management.
- **Password default admin produksi**: Akan disetel via file `.env` di tahap backend.
