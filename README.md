# Admin Panel — Full-Stack Starter Pack

Template aplikasi web **Admin Panel** siap pakai dengan autentikasi JWT + httpOnly refresh cookie, manajemen user, manajemen menu & sub-menu dinamis dari PostgreSQL, hak akses per menu (**Read** / **Write**), tema terang & gelap, sidebar *collapsible*, dan pembaruan realtime via WebSocket.

> **Untuk AI atau developer yang melanjutkan proyek ini:** Wajib membaca `AGENTS.md` lebih dulu. File tersebut berisi aturan dan standar resmi proyek.

---

## Fitur Utama

- **Autentikasi & Keamanan**:
  - Login dengan hashing password `argon2id`, rate limiter anti brute-force, JWT access token berumur pendek di memori, serta refresh token rotasi otomatis di `httpOnly` cookie.
  - Ganti password pengguna dan reset password sementara acak oleh admin.
- **User Management & Hak Akses Per Menu (`Read` / `Write`)**:
  - Pencarian, filter status (*Active* / *Inactive*), tambah, ubah, aktif/nonaktif, dan hapus user (dilengkapi proteksi agar tidak bisa menghapus/menonaktifkan diri sendiri atau admin aktif terakhir).
  - Pengecekan hak akses **Read** (hanya lihat) dan **Write** (lihat, tambah, ubah, hapus) ditegakkan di backend FastAPI dan otomatis menyesuaikan UI.
- **Menu Management & Sub-Menu Dinamis**:
  - Seluruh menu dan sub-menu disimpan di tabel `menus` PostgreSQL dan dapat dikelola langsung dari halaman **Menu Management** (tambah, edit, ikon visual, grup sidebar, urutan tampil, aktif/nonaktif, hapus).
  - Sub-menu di sidebar mendukung mode akordeon otomatis (hanya terbuka sesuai halaman/menu aktif dan menutup kembali saat berpindah halaman).
- **Sinkronisasi Realtime (WebSocket)**:
  - Perubahan data user, perubahan permission menu, atau perubahan daftar menu langsung disiarkan lewat WebSocket (`/ws`) tanpa perlu refresh halaman; user yang dinonaktifkan/dihapus otomatis keluar dari sesi.
- **UI Modern, Tema Terang/Gelap & Responsif**:
  - **Light Mode & Dark Mode** persisten dengan CSS variables, tombol toggle di Topbar kanan atas.
  - **Sidebar Collapsible** (`260px` *expanded* / `74px` *collapsed* ikon saja dengan flyout untuk sub-menu), plus menu akun di bagian bawah sidebar.
  - **Judul & Branding Dinamis** terpusat di `frontend/src/data/config.js`.
  - Responsif di desktop, tablet (`<=1024px` drawer), dan smartphone (`<=768px` tabel kartu & bottom sheet).

---

## Prasyarat Alat

1. **Node.js LTS** (v18 atau lebih baru) — https://nodejs.org
2. **Python 3.12** — `winget install -e --id Python.Python.3.12`
3. **PostgreSQL 16** *(otomatis dipasang oleh skrip `setup_database.py` di Windows jika belum ada)*

---

## Setup Pertama Kali

### 1. Backend & Database PostgreSQL (`backend/`)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/setup_database.py   # buat rahasia .env, pasang PostgreSQL bila belum ada, buat role + database
.\.venv\Scripts\python.exe -m alembic upgrade head      # buat seluruh tabel database
.\.venv\Scripts\python.exe -m app.seed                  # isi menu default + akun admin awal
```

- **Rahasia & Kredensial**: Disimpan otomatis ke `backend/.env` (untuk aplikasi) dan `backend/.env.admin` (superuser PostgreSQL, hanya dipakai oleh `setup_database.py`). Keduanya berstatus hidden, dibatasi hak akses user Windows, dan masuk `.gitignore`. Contoh variabel tersedia di `backend/.env.example`.
- **Database & Role**: Aplikasi memakai database `admin_panel` dengan role `admin_panel_app` (*least privilege*, bukan superuser).
- **Akun Admin Awal**: Username **`admin`** dengan password default yang dibuat otomatis di `backend/.env` (`ADMIN_DEFAULT_PASSWORD`).
- **Skema Tabel**: Lihat `backend/docs/ERD.md`. Setiap perubahan model wajib lewat `alembic revision --autogenerate` dan `alembic upgrade head`.

### 2. Frontend (`frontend/`)

```powershell
cd frontend
npm install
```

---

## Menjalankan Aplikasi

### Cara Cepat (Windows)
Klik dua kali file **`start.bat`** di folder utama proyek untuk menyalakan backend (port `8000`), frontend (port `5173`), dan membuka browser otomatis ke `http://localhost:5173`.

### Manual (2 Terminal)

**Terminal 1 — Backend FastAPI (port `8000`):**
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend Vite (port `5173`, proxy `/api` & `/ws` ke port `8000`):**
```powershell
cd frontend
npm run dev
```

- Buka `http://localhost:5173`, lalu login dengan username **`admin`** dan password `ADMIN_DEFAULT_PASSWORD` dari `backend/.env`.
- Dokumentasi API Swagger tersedia di `http://localhost:8000/docs` dan health check di `http://localhost:8000/api/health`.

---

## Pengujian & Build

**Automated Test Backend (`pytest`):**
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

**Build Produksi Frontend:**
```powershell
cd frontend
npm run build
```

| Perintah Frontend | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan dev server di `localhost:5173` |
| `npm run dev:lan` | Menjalankan dev server agar bisa diakses perangkat lain di jaringan lokal |
| `npm run build` | Membuat bundle produksi di folder `dist/` |
| `npm run preview` | Menjalankan preview dari folder `dist/` |

---

## Tahap Berikutnya

1. **Penyempurnaan**: Docker (`docker-compose`), pengecekan akhir responsivitas, dan hardening produksi.
