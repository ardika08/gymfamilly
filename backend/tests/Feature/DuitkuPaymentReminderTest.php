<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DuitkuPaymentReminderTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_request_payment_reminder_for_pending_transaction(): void
    {
        config([
            'app.env' => 'local',
            'services.starsender.api_key' => 'test-key',
            'services.starsender.device_id' => 'test-device',
            'services.starsender.base_url' => 'https://api.starsender.online/api',
            'app.frontend_url' => 'https://gymfamilly.com',
        ]);
        Http::fake(['*' => Http::response(['status' => true], 200)]);

        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan', 'harga_normal' => 160000,
            'harga_promo' => 145000, 'deskripsi' => 'Paket uji', 'durasi_hari' => 30,
        ]);
        $membership = Membership::create([
            'user_id' => $member->id, 'package_id' => $package->id,
            'status' => 'menunggu_pembayaran', 'payment_method' => 'duitku',
            'payment_channel' => 'SQ', 'payment_url' => 'https://pay.example/abc',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$member->createToken('test')->plainTextToken)
            ->postJson('/api/membership/duitku/payment-reminder', ['membershipId' => $membership->id]);

        $response->assertOk()->assertJsonPath('data.sent', false);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id, 'type' => 'payment_reminder',
            'target' => $member->whatsapp,
        ]);
        $log = NotificationLog::query()->where('type', 'payment_reminder')->firstOrFail();
        $this->assertStringContainsString('https://pay.example/abc', $log->message);
    }

    public function test_payment_reminder_cannot_be_requested_for_another_member(): void
    {
        $member = User::factory()->create();
        $other = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan', 'harga_normal' => 160000,
            'harga_promo' => 145000, 'deskripsi' => 'Paket uji', 'durasi_hari' => 30,
        ]);
        $membership = Membership::create([
            'user_id' => $other->id, 'package_id' => $package->id,
            'status' => 'menunggu_pembayaran', 'payment_url' => 'https://pay.example/abc',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$member->createToken('test')->plainTextToken)
            ->postJson('/api/membership/duitku/payment-reminder', ['membershipId' => $membership->id])
            ->assertNotFound();
    }
}
