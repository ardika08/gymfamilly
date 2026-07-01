<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_only_check_in_once_per_day(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 160000,
            'harga_promo' => 145000,
            'deskripsi' => 'FREE pinjaman handuk',
        ]);

        Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'tanggal_mulai' => now()->format('Y-m-d'),
            'tanggal_berakhir' => now()->addMonth()->format('Y-m-d'),
            'status' => 'aktif',
        ]);

        $token = $admin->createToken('test')->plainTextToken;

        $first = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/scan/barcode', [
                'qr_code' => "GF|member:{$member->id}|membership:1",
            ]);

        $second = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/scan/barcode', [
                'qr_code' => "GF|member:{$member->id}|membership:1",
            ]);

        $first->assertOk();
        $second->assertUnprocessable()->assertJsonPath('message', 'Member sudah check-in hari ini.');
        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id,
            'type' => 'check_in_success',
        ]);

        $log = NotificationLog::query()->where('type', 'check_in_success')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString('Pesan otomatis dari Admin Gym Familly', $log->message);
    }
}
