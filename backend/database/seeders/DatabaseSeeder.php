<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Expense;
use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        Message::query()->delete();
        Attendance::query()->delete();
        Membership::query()->delete();
        Expense::query()->delete();
        GymPackage::query()->delete();
        User::where('role', 'member')->delete();

        User::updateOrCreate(
            ['email' => 'admin@gymfamilly.id'],
            [
                'nama' => 'Admin Gym Familly',
                'password' => Hash::make(env('ADMIN_DEFAULT_PASSWORD', 'GymFam!2026#Secure')),
                'role' => 'admin',
                'whatsapp' => '081234567890',
                'account_status' => 'aktif',
            ],
        );

        User::updateOrCreate(
            ['email' => 'member@gymfamilly.id'],
            [
                'nama' => 'Member Demo',
                'password' => Hash::make('member123'),
                'role' => 'member',
                'whatsapp' => '081298765432',
                'account_status' => 'aktif',
            ],
        );

        $packages = [
            ['nama_paket' => 'Harian', 'harga_normal' => 15000, 'harga_promo' => null, 'deskripsi' => 'FREE pinjaman handuk', 'durasi_hari' => 1],
            ['nama_paket' => '1 Bulan', 'harga_normal' => 160000, 'harga_promo' => null, 'deskripsi' => 'FREE pinjaman handuk', 'durasi_hari' => 30],
            ['nama_paket' => '1 Bulan Pelajar', 'harga_normal' => 100000, 'harga_promo' => null, 'deskripsi' => 'FREE pinjaman handuk', 'durasi_hari' => 30],
            ['nama_paket' => '3 Bulan', 'harga_normal' => 330000, 'harga_promo' => null, 'deskripsi' => 'FREE pinjaman handuk', 'durasi_hari' => 90],
            ['nama_paket' => '6 Bulan', 'harga_normal' => 660000, 'harga_promo' => null, 'deskripsi' => 'FREE pinjaman handuk', 'durasi_hari' => 180],
            ['nama_paket' => '12 Bulan', 'harga_normal' => 1300000, 'harga_promo' => null, 'deskripsi' => 'FREE pinjaman handuk', 'durasi_hari' => 365],
        ];

        foreach ($packages as $pkg) {
            GymPackage::create($pkg);
        }
    }
}
