<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_send_message_and_admin_can_reply(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create();

        $memberToken = $member->createToken('member')->plainTextToken;

        $send = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->postJson('/api/messages/send', [
                'isi_pesan' => 'Halo admin',
            ]);

        $reply = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/messages/reply', [
                'memberId' => $member->id,
                'isi_pesan' => 'Halo juga',
            ]);

        $send->assertCreated();
        $reply->assertCreated();
    }
}
