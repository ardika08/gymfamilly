<?php

namespace Tests\Feature;

use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'nama' => 'Member Baru',
            'email' => 'baru@example.com',
            'whatsapp' => '081234567891',
            'password' => 'secret123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.role', 'member')
            ->assertJsonStructure(['data' => ['token', 'user']]);

        $this->assertDatabaseHas('notifications', [
            'type' => 'register_success',
            'target' => '081234567891',
        ]);

        $log = NotificationLog::query()->where('type', 'register_success')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString('Pesan otomatis dari Admin Gym Familly', $log->message);
    }

    public function test_admin_route_is_forbidden_for_member(): void
    {
        $member = User::factory()->create();

        $response = $this->withHeader('Authorization', 'Bearer '.$member->createToken('test')->plainTextToken)
            ->getJson('/api/admin/members');

        $response->assertForbidden();
    }
}
