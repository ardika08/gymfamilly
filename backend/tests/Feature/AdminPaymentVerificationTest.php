<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminPaymentVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_verify_payment_and_notification_log_is_created(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '3 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 330000,
            'harga_promo' => 299000,
            'deskripsi' => 'FREE pinjaman handuk',
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken)
            ->postJson('/api/admin/membership/verify', [
                'membershipId' => $membership->id,
            ]);

        $response->assertOk()->assertJsonPath('data.status', 'aktif');
        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id,
            'type' => 'payment_verified',
        ]);

        $log = NotificationLog::query()->where('type', 'payment_verified')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString('Pesan otomatis dari Admin Gym Familly', $log->message);
    }
}
