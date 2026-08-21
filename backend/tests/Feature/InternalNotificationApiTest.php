<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InternalNotificationApiTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-internal-secret';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.internal.secret' => self::SECRET,
            'services.starsender.api_key' => 'test-key',
            'services.starsender.base_url' => 'https://api.starsender.online/api',
        ]);

        Http::fake([
            '*' => Http::response(['status' => true], 200),
        ]);
    }

    public function test_internal_notification_can_target_a_raw_phone_number(): void
    {
        $response = $this->withHeader('X-Internal-Secret', self::SECRET)
            ->postJson('/api/internal/notify/wa', [
                'target' => '085924540663',
                'type' => 'manual_smoke_test',
                'message' => 'Tes integrasi Starsender dari local.',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.target', '085924540663')
            ->assertJsonPath('data.type', 'manual_smoke_test');

        $this->assertDatabaseHas('notifications', [
            'target' => '085924540663',
            'type' => 'manual_smoke_test',
        ]);
    }

    public function test_internal_notification_is_rejected_without_secret(): void
    {
        $response = $this->postJson('/api/internal/notify/wa', [
            'target' => '085924540663',
            'type' => 'manual_smoke_test',
            'message' => 'Percobaan tanpa secret.',
        ]);

        $response->assertStatus(401);

        $this->assertDatabaseMissing('notifications', [
            'target' => '085924540663',
        ]);
    }

    public function test_internal_notification_is_rejected_with_wrong_secret(): void
    {
        $response = $this->withHeader('X-Internal-Secret', 'salah')
            ->postJson('/api/internal/notify/wa', [
                'target' => '085924540663',
                'type' => 'manual_smoke_test',
                'message' => 'Percobaan dengan secret salah.',
            ]);

        $response->assertStatus(401);

        $this->assertDatabaseMissing('notifications', [
            'target' => '085924540663',
        ]);
    }
}
