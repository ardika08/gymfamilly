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
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'whatsapp' => '081234567890',
                'account_status' => 'aktif',
            ],
        );
    }
}
