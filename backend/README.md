# Gym Familly Backend

Backend ini memakai Laravel 12, MySQL/SQLite, dan Laravel Sanctum untuk melayani frontend React pada repo yang sama.

## Fitur yang sudah aktif

- Auth bearer token dengan Sanctum
- Role `admin` dan `member`
- Paket membership dan promo
- Checkout membership + upload bukti transfer gambar
- Verifikasi pembayaran admin
- QR code membership aktif
- Check-in admin dengan aturan 1x per hari per member
- Inbox member dan admin
- Dashboard, daftar member, finance, expenses
- Log notifikasi WhatsApp dan scheduler reminder H-3

## Endpoint utama

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/packages`
- `POST /api/membership/checkout`
- `POST /api/membership/upload-proof`
- `GET /api/member/barcode`
- `POST /api/admin/scan/barcode`
- `POST /api/admin/membership/verify`

## Setup lokal

### Opsi Herd (direkomendasikan untuk local Windows)

Backend lokal disiapkan untuk domain `http://backend.test`.

1. Pastikan `.env` memakai:
   - `APP_URL=http://backend.test`
   - `FRONTEND_URL=http://localhost:5173`
   - `DB_CONNECTION=sqlite`
2. Jalankan:
   - `php artisan migrate:fresh --seed`
   - `php artisan storage:link`
3. Dari root repo, jalankan script Herd link:

```bash
npm run backend:herd:link
```

4. Akses backend di `http://backend.test`

Frontend tetap dijalankan lewat Vite dari root repo dengan `npm run dev`.

1. Salin `.env.example` menjadi `.env`
2. Isi koneksi database
3. Jalankan `php artisan key:generate`
4. Jalankan `php artisan migrate:fresh --seed`
5. Jalankan `php artisan storage:link`
6. Jalankan `php artisan serve`

Untuk frontend dari root repo:

1. Jalankan `npm install`
2. Jalankan `npm run dev`

## Environment penting

- `APP_URL`
- `FRONTEND_URL`
- `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `FILESYSTEM_DISK=public`
- `STARSENDER_BASE_URL`
- `STARSENDER_API_KEY`
- `STARSENDER_DEVICE_ID`

## Akun seed default

- Admin: `admin@gymfamilly.id` / `admin123`
- Member: `member@gymfamilly.id` / `member123`

## Test

- `php artisan test`

## Scheduler

Command reminder:

- `php artisan gym:send-membership-reminders`

Jadwal harian sudah didaftarkan di `routes/console.php`.
