<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DuitkuCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.duitku.merchant_code' => 'DTESTGF',
            'services.duitku.api_key' => 'test-api-key',
            'services.duitku.base_url' => 'https://duitku.test/api/merchant',
            'services.duitku.callback_url' => 'https://api.example.test/webhooks/duitku',
            'services.duitku.return_url' => 'https://example.test/member/payments',
            'services.duitku.expiry_period' => 1440,
        ]);
    }

    public function test_fresh_pending_invoice_still_blocks_duplicate_checkout(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => 'Paket Harian',
            'harga_normal' => 15000,
            'deskripsi' => null,
            'durasi_hari' => 1,
        ]);

        $pending = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'duitku',
            'payment_channel' => 'SQ',
            'merchant_order_id' => 'GF-FRESH-1',
            'payment_url' => 'https://passport.duitku.test/pay/FRESH',
        ]);

        Http::fake();

        $response = $this->withHeader(
            'Authorization',
            'Bearer '.$member->createToken('test')->plainTextToken,
        )->postJson('/api/membership/duitku/checkout', [
            'packageId' => $package->id,
            'paymentMethod' => 'SQ',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Masih ada membership yang menunggu pembayaran.');

        $this->assertSame('menunggu_pembayaran', $pending->fresh()->status);
        Http::assertNothingSent();
    }

    public function test_expired_pending_invoice_does_not_block_new_checkout(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => 'Paket Harian',
            'harga_normal' => 15000,
            'deskripsi' => null,
            'durasi_hari' => 1,
        ]);

        $expiredPending = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'duitku',
            'payment_channel' => 'SQ',
            'merchant_order_id' => 'GF-OLD-1',
            'payment_url' => 'https://passport.duitku.test/expired',
        ]);
        $expiredPending->forceFill([
            'created_at' => now()->subMinutes(1446),
            'updated_at' => now()->subMinutes(1446),
        ])->saveQuietly();

        Http::fake([
            'https://duitku.test/api/merchant/v2/inquiry' => Http::response([
                'paymentUrl' => 'https://passport.duitku.test/pay/NEW',
                'reference' => 'REF-NEW',
                'amount' => 15000,
                'statusCode' => '00',
                'statusMessage' => 'SUCCESS',
            ], 200),
        ]);

        $response = $this->withHeader(
            'Authorization',
            'Bearer '.$member->createToken('test')->plainTextToken,
        )->postJson('/api/membership/duitku/checkout', [
            'packageId' => $package->id,
            'paymentMethod' => 'SQ',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.payment_url', 'https://passport.duitku.test/pay/NEW');

        $this->assertDatabaseHas('memberships', [
            'id' => $expiredPending->id,
            'status' => 'kedaluwarsa',
            'payment_url' => null,
        ]);
        $this->assertDatabaseHas('memberships', [
            'user_id' => $member->id,
            'status' => 'menunggu_pembayaran',
            'duitku_reference' => 'REF-NEW',
        ]);
    }
}
