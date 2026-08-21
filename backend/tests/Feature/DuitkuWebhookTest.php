<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DuitkuWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const MERCHANT_CODE = 'DTESTGF';
    private const API_KEY = 'test-api-key';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.duitku.merchant_code' => self::MERCHANT_CODE,
            'services.duitku.api_key' => self::API_KEY,
        ]);
    }

    private function makePendingMembership(int $amount = 145000): Membership
    {
        $user = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan',
            'harga_normal' => 160000,
            'harga_promo' => $amount,
            'deskripsi' => 'Paket uji',
            'durasi_hari' => 30,
        ]);

        return Membership::create([
            'user_id' => $user->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'duitku',
            'merchant_order_id' => 'GF-TEST-1',
        ]);
    }

    private function callbackPayload(string $orderId, string $amount, string $resultCode): array
    {
        return [
            'merchantCode' => self::MERCHANT_CODE,
            'amount' => $amount,
            'merchantOrderId' => $orderId,
            'resultCode' => $resultCode,
            'reference' => 'REF-123',
            'signature' => md5(self::MERCHANT_CODE . $amount . $orderId . self::API_KEY),
        ];
    }

    public function test_active_membership_is_not_expired_by_late_failure_callback(): void
    {
        $membership = $this->makePendingMembership();

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload('GF-TEST-1', '145000', '00'))
            ->assertOk();

        $this->assertSame('aktif', $membership->fresh()->status);

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload('GF-TEST-1', '145000', '01'))
            ->assertOk();

        $this->assertSame('aktif', $membership->fresh()->status);
    }

    public function test_duplicate_success_callback_does_not_extend_membership(): void
    {
        $membership = $this->makePendingMembership();

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload('GF-TEST-1', '145000', '00'))
            ->assertOk();

        $first = $membership->fresh();

        $this->travel(2)->days();

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload('GF-TEST-1', '145000', '00'))
            ->assertOk();

        $second = $membership->fresh();

        $this->assertSame(
            $first->tanggal_berakhir->format('Y-m-d'),
            $second->tanggal_berakhir->format('Y-m-d')
        );
        $this->assertSame(
            $first->paid_at->toDateTimeString(),
            $second->paid_at->toDateTimeString()
        );
    }

    public function test_callback_with_mismatched_amount_is_rejected(): void
    {
        $membership = $this->makePendingMembership();

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload('GF-TEST-1', '1000', '00'))
            ->assertStatus(422);

        $this->assertSame('menunggu_pembayaran', $membership->fresh()->status);
    }

    public function test_invalid_signature_is_rejected(): void
    {
        $membership = $this->makePendingMembership();

        $payload = $this->callbackPayload('GF-TEST-1', '145000', '00');
        $payload['signature'] = 'bogus';

        $this->postJson('/api/webhooks/duitku', $payload)->assertStatus(401);

        $this->assertSame('menunggu_pembayaran', $membership->fresh()->status);
    }
}
