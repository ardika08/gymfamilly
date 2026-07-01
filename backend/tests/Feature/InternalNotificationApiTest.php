<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InternalNotificationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_internal_notification_can_target_a_raw_phone_number(): void
    {
        $response = $this->postJson('/api/internal/notify/wa', [
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
}
