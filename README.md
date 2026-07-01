# Gym Familly

Project ini sekarang memakai:

- Frontend: React + Vite
- Backend: Laravel 12 + Sanctum
- Storage bukti transfer: Laravel public storage
- QR check-in: payload dari backend Laravel

## Menjalankan project

### Mode Herd Lokal

Backend Laravel lokal diprioritaskan berjalan lewat Herd di `http://backend.test`, sedangkan frontend tetap lewat Vite di `http://localhost:5173`.

#### Backend via Herd

Masuk ke [backend](/E:/Aplikasi/gymfamily/backend), lalu jalankan:

```bash
php artisan migrate:fresh --seed
php artisan storage:link
```

Dari root repo, link site Laravel ke Herd:

```bash
npm run backend:herd:link
```

Setelah itu backend diharapkan tersedia di `http://backend.test`.

#### Frontend via Vite

Dari root repo:

```bash
npm install
npm run dev
```

File [.env.development](/E:/Aplikasi/gymfamily/.env.development) sudah mengarahkan frontend ke `http://backend.test`.

### Mode Fallback Command Line

Jika Herd tidak dipakai, backend masih bisa dijalankan manual.

Masuk ke [backend](/E:/Aplikasi/gymfamily/backend), lalu:

```bash
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve
```

### Frontend

Dari root repo:

```bash
npm run dev:fallback
```

Script fallback ini akan menjalankan `php artisan serve` dan Vite bersama-sama.

## Script penting

```bash
npm run dev
npm run dev:fallback
npm run build
npm run backend:fresh
npm run backend:test
npm run backend:herd:link
```

## Catatan

- Backend Express lama sudah dihentikan dari workflow aktif.
- Kredensial Starsender masih perlu diisi di `backend/.env`.
- `backend/.env.example` sudah disiapkan untuk target MySQL/VPS.
- Jika `herd` belum ada di PATH, script `backend:herd:link` tetap memakai lokasi executable Herd bawaan Windows.
