<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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

    public function test_admin_cannot_activate_duitku_payment_while_gateway_is_processing(): void
    {
        config([
            'services.duitku.merchant_code' => 'DTESTGF',
            'services.duitku.api_key' => 'test-api-key',
            'services.duitku.base_url' => 'https://duitku.test/api/merchant',
        ]);

        Http::fake([
            'https://duitku.test/api/merchant/transactionStatus' => Http::response([
                'statusCode' => '01',
                'statusMessage' => 'PROCESS',
                'reference' => 'REF-PROCESS',
                'amount' => 130000,
            ]),
        ]);

        [$admin, $membership] = $this->makeDuitkuMembership('menunggu_pembayaran');

        $response = $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken)
            ->postJson('/api/admin/membership/verify', ['membershipId' => $membership->id]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Pembayaran Duitku belum berhasil. Status saat ini: PROCESS.');

        $membership->refresh();
        $this->assertSame('menunggu_pembayaran', $membership->status);
        $this->assertNull($membership->paid_at);
        $this->assertNull($membership->verified_at);
    }

    public function test_admin_can_activate_duitku_payment_only_after_gateway_success(): void
    {
        config([
            'services.duitku.merchant_code' => 'DTESTGF',
            'services.duitku.api_key' => 'test-api-key',
            'services.duitku.base_url' => 'https://duitku.test/api/merchant',
        ]);

        Http::fake([
            'https://duitku.test/api/merchant/transactionStatus' => Http::response([
                'statusCode' => '00',
                'statusMessage' => 'SUCCESS',
                'reference' => 'REF-SUCCESS',
                'amount' => 130000,
            ]),
        ]);

        [$admin, $membership] = $this->makeDuitkuMembership('menunggu_pembayaran');

        $response = $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken)
            ->postJson('/api/admin/membership/verify', ['membershipId' => $membership->id]);

        $response->assertOk()->assertJsonPath('data.status', 'aktif');

        $membership->refresh();
        $this->assertNotNull($membership->paid_at);
        $this->assertNotNull($membership->verified_at);
        $this->assertNull($membership->payment_url);
        $this->assertSame('REF-SUCCESS', $membership->duitku_reference);
    }

    public function test_admin_rejects_duitku_success_when_paid_amount_does_not_match(): void
    {
        config([
            'services.duitku.merchant_code' => 'DTESTGF',
            'services.duitku.api_key' => 'test-api-key',
            'services.duitku.base_url' => 'https://duitku.test/api/merchant',
        ]);

        Http::fake([
            'https://duitku.test/api/merchant/transactionStatus' => Http::response([
                'statusCode' => '00',
                'statusMessage' => 'SUCCESS',
                'reference' => 'REF-WRONG-AMOUNT',
                'amount' => 1000,
            ]),
        ]);

        [$admin, $membership] = $this->makeDuitkuMembership('menunggu_pembayaran');

        $response = $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken)
            ->postJson('/api/admin/membership/verify', ['membershipId' => $membership->id]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Nominal pembayaran Duitku tidak sesuai dengan tagihan.');
        $this->assertSame('menunggu_pembayaran', $membership->fresh()->status);
    }

    public function test_admin_cannot_verify_an_already_active_membership_again(): void
    {
        [$admin, $membership] = $this->makeDuitkuMembership('aktif');
        $membership->update([
            'tanggal_mulai' => now()->subDays(10)->format('Y-m-d'),
            'tanggal_berakhir' => now()->addDays(20)->format('Y-m-d'),
            'paid_at' => now()->subDays(10),
            'verified_at' => now()->subDays(10),
        ]);
        $originalEndDate = $membership->fresh()->tanggal_berakhir->format('Y-m-d');

        $response = $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken)
            ->postJson('/api/admin/membership/verify', ['membershipId' => $membership->id]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Membership ini sudah aktif.');
        $this->assertSame($originalEndDate, $membership->fresh()->tanggal_berakhir->format('Y-m-d'));
    }

    private function makeDuitkuMembership(string $status): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => 'Perpanjang Paket 1 Bulan',
            'harga_normal' => 130000,
            'deskripsi' => null,
            'durasi_hari' => 30,
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => $status,
            'payment_method' => 'duitku',
            'payment_channel' => 'SQ',
            'merchant_order_id' => 'GF-TEST-'.$member->id,
            'payment_url' => 'https://passport.duitku.test/pay/TEST',
        ]);

        return [$admin, $membership];
    }
}
