# FlexAdmin: Tahap 1 (Desain UI)

Aplikasi web admin modern dengan manajemen user, hak akses per menu (Read / Write), tema terang & gelap, serta sidebar yang dapat membesar/mengecil (collapsible).
Tahap ini berupa **frontend** (React + Vite) dengan **data dummy**, siap dievaluasi tampilannya sebelum masuk ke backend.
Backend Python (FastAPI) dan database PostgreSQL menyusul di tahap berikutnya.

> **Untuk AI atau developer yang melanjutkan proyek ini:** Wajib membaca `AGENTS.md` lebih dulu. File tersebut berisi aturan dan standar resmi proyek.

---

## Fitur Utama Tahap Ini

- **Sidebar Collapsible (Membesar & Mengecil)**:
  - Mode membesar (*expanded* - 264px): Menampilkan logo, nama brand, nama menu lengkap, label kategori, badge level akses, dan nama user.
  - Mode mengecil (*collapsed* - 74px): Menampilkan ikon menu saja (centered), tooltip saat kursor diarahkan ke ikon, divider kategori tipis, dan avatar user.
  - **Satu Tombol Toggle Lingkaran**: Mengapung di garis batas border kanan sidebar. Panah `<` mengarah ke kiri saat terbuka (untuk menutup/mengecilkan) dan panah `>` mengarah ke kanan saat tertutup (untuk membuka/membesarkan).
  - Pengaturan tersimpan otomatis di browser (`localStorage`).
- **Judul & Branding Dinamis**:
  - Judul aplikasi dan singkatan inisial logo dipusatkan di `src/data/config.js` (`APP_CONFIG.title` & `APP_CONFIG.shortName`), sehingga bisa diubah judulnya kapan saja dengan cepat.
- **Mode Tema (Light & Dark Mode)**:
  - **Light Mode**: Bersih dengan dominasi kartu putih dan aksen teal FlexAdmin.
  - **Dark Mode**: Elegan dengan latar deep teal/charcoal (`#0b1517`) dan kartu surface (`#122225`), ramah di mata untuk penggunaan malam hari.
  - Tombol beralih tema (ikon Matahari / Bulan) di Topbar kanan, tersimpan secara persisten.
- **Standarisasi Bahasa Inggris (English UI)**:
  - Seluruh teks menu, tombol, form, modal dialog, status, dan pesan notifikasi terstandarisasi dalam Bahasa Inggris.
- **Dashboard & Metrik Realtime (Simulasi)**:
  - Kartu ringkasan harian, pergerakan metrik berkala, grafik pendapatan (Area Chart), Team Pulse, dan Recent Activity.
- **User Management**:
  - Pencarian (nama, username, email), filter status (All / Active / Inactive).
  - Tambah & ubah user, reset password ke default, aktifkan / nonaktifkan akun, dan hapus user.
- **Hak Akses per Menu (Read / Write)**:
  - Menu Permissions modal: atur Read (hanya lihat) atau Write (lihat, tambah, ubah, hapus). Menu tanpa izin disembunyikan otomatis.
- **Desain Responsif**:
  - Laptop / Desktop: Sidebar tetap di kiri (dapat diexpand/collapse).
  - Tablet & Ponsel (≤1024px): Sidebar menjadi drawer overlay, tombol panah desktop dihilangkan total dan hanya menyisakan tombol menu garis 3 (hamburger) yang bersih di Topbar, serta tombol `x` di dalam drawer.
  - Smartphone (≤768px): Tabel otomatis menjadi kartu vertikal, dialog menjadi bottom sheet.

---

## Akun Demo Awal

| Username | Password | Role / Permissions | Keterangan |
|---|---|---|---|
| `admin` | `Admin@12345` | Superadmin (Full Access) | Wajib mengganti password saat login pertama |
| `siti` | `Welcome@123` | Dashboard (Write), Reports (Write), Inventory (Read) | Akun staf dengan akses sebagian |
| `budi` | `Welcome@123` | Dashboard (Read), Reports (Read) | Akun staf dengan akses Read-only |
| `dewi` | `Welcome@123` | Inactive (Nonaktif) | Akun nonaktif untuk demo pemblokiran login |

*(Data akun di atas disimpan di browser dan disinkronkan antar-tab untuk simulasi realtime).*

---

## Cara Menjalankan di VSCode

### 1. Prasyarat Alat (Sekali Saja)

1. Pasang **Node.js LTS** (v18 atau lebih baru) dari https://nodejs.org.
2. Pasang **Visual Studio Code** dari https://code.visualstudio.com.
3. Pastikan `node -v` dan `npm -v` dapat dijalankan di terminal.

### 2. Membuka Proyek

1. Buka VSCode.
2. Pilih menu **File > Open Folder...**, lalu pilih folder `webapp`.

### 3. Install Dependensi (Sekali Saja)

Buka terminal di VSCode (**Terminal > New Terminal** atau tekan `` Ctrl+` ``), lalu jalankan:

```powershell
cd frontend
npm install
```

### 4. Jalankan Aplikasi

```powershell
npm run dev
```

Buka URL yang tertera di terminal di browser Anda:
```
http://localhost:5173/
```
Login menggunakan akun demo: `admin` / `Admin@12345`.

---

## Mencoba Fitur Baru

1. **Sidebar Collapsible**:
   - Di tampilan laptop/desktop, klik tombol panah di header sidebar atau ikon panel di sebelah bilah pencarian Topbar.
   - Perhatikan sidebar mengecil rapi menjadi 74px dengan ikon yang terpusat.
   - Arahkan kursor ke setiap ikon menu untuk melihat tooltip nama menu.
   - Refresh halaman: posisi sidebar tetap diingat.
2. **Mode Gelap (Dark Mode)**:
   - Klik ikon Bulan di Topbar kanan atas.
   - Tampilan seketika berpindah ke tema gelap.
   - Klik kembali ikon Matahari untuk beralih ke tema terang.
3. **Simulasi Realtime Lintas Tab**:
   - Buka 2 tab browser di `http://localhost:5173/`.
   - Tab 1: Login sebagai `admin`. Tab 2: Login sebagai `budi`.
   - Di Tab 1, buka **User Management**, klik ikon perisai pada Budi, ubah hak akses **Reports** menjadi *Write*, lalu simpan.
   - Perhatikan Tab 2: badge "Read" langsung hilang dan tombol aksi terbuka seketika tanpa refresh halaman!

---

## Perintah npm

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan dev server di `localhost:5173` |
| `npm run dev:lan` | Menjalankan dev server agar bisa diakses HP di jaringan Wi-Fi lokal |
| `npm run build` | Membuat bundle produksi di folder `dist/` |
| `npm run preview` | Menjalankan preview dari folder `dist/` |

---

## Tahap 2: Database PostgreSQL (folder `backend/`)

Prasyarat: Windows, Python 3.12 (`winget install -e --id Python.Python.3.12`).

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/setup_database.py   # buat rahasia, pasang PostgreSQL bila belum ada, buat role + database
.\.venv\Scripts\python.exe -m alembic upgrade head      # buat tabel
.\.venv\Scripts\python.exe -m app.seed                  # isi menu + akun admin awal
```

- **Rahasia** ada di `backend/.env` (dipakai aplikasi) dan `backend/.env.admin` (superuser PostgreSQL, hanya untuk skrip setup). Keduanya hidden, hanya bisa dibaca akun Windows Anda, dan masuk `.gitignore`. Jangan dikirim atau di-commit. Contoh nama variabel ada di `backend/.env.example`.
- Aplikasi memakai role `flexadmin_app` (bukan superuser, hanya akses ke database `flexadmin`).
- Password awal admin ada di `backend/.env` (`ADMIN_DEFAULT_PASSWORD`). Wajib diganti saat login pertama.
- Migrasi baru: ubah model di `app/models/`, lalu `alembic revision --autogenerate -m "pesan"` dan `alembic upgrade head`.
- Skema tabel: lihat `backend/docs/ERD.md`.
- Pengamanan tambahan: batasi PostgreSQL ke localhost dengan `listen_addresses = 'localhost'` (sudah diset lewat `ALTER SYSTEM`, aktif setelah service PostgreSQL di-restart atau komputer di-reboot).

## Tahap 3: Backend Inti FastAPI (folder `backend/`)

Menjalankan server API + WebSocket (port `8000`):

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

- Dokumentasi interaktif Swagger tersedia di `http://localhost:8000/docs`.
- Health check database: `GET http://localhost:8000/api/health`.
- Menjalankan automated test (`pytest`):

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

Ringkasan endpoint:
- **Auth**: `POST /api/auth/login` (dilengkapi rate limit), `POST /api/auth/refresh` (httpOnly cookie rotation), `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`.
- **Users & Permissions** *(wajib izin `user_management`)*: `GET /api/users`, `POST /api/users`, `PUT /api/users/{id}`, `PATCH /api/users/{id}/toggle-active`, `DELETE /api/users/{id}`, `POST /api/users/{id}/reset-password`, `PUT /api/users/{id}/permissions`.
- **Menus & Audit**: `GET /api/menus`, `GET /api/menus/catalog`, `GET /api/audit-logs`.
- **Realtime**: `WebSocket /ws?token=<access_token>`.

## Tahap 4: Integrasi Frontend + Backend + WebSocket Realtime

**Cara cepat (double-click):**
- Klik dua kali file **`start.bat`** di folder utama (`webapp/start.bat`) untuk menyalakan backend (port `8000`), frontend (port `5173`), dan membuka browser otomatis.

**Atau jalankan manual lewat 2 terminal secara bersamaan:**

**Terminal 1 — Backend FastAPI (port `8000`):**

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend Vite (port `5173`, otomatis proxy `/api` & `/ws` ke port `8000`):**

```powershell
cd frontend
npm run dev
```

- Buka `http://localhost:5173` lalu login menggunakan username **`admin`** dan password dari `backend/.env` (`ADMIN_DEFAULT_PASSWORD`).
- Semua data user, password (argon2id), dan permission menu langsung tersimpan di PostgreSQL dan tersinkronisasi realtime lewat WebSocket ke seluruh tab/browser yang aktif.

## Tahap Berikutnya

1. **Penyempurnaan**: Docker (`docker-compose`), pengecekan akhir responsivitas, dan dokumentasi produksi.
