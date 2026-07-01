<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MembershipNotificationCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_expiry_reminder_command_creates_notification_log(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 160000,
            'harga_promo' => 145000,
            'deskripsi' => 'FREE pinjaman handuk',
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'tanggal_mulai' => now()->subDays(27)->format('Y-m-d'),
            'tanggal_berakhir' => now()->addDays(3)->format('Y-m-d'),
            'status' => 'aktif',
        ]);

        $this->artisan('gym:send-membership-reminders')->assertSuccessful();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id,
            'type' => 'membership_expiry_reminder',
        ]);

        $log = NotificationLog::query()->where('type', 'membership_expiry_reminder')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString((string) $membership->id, json_encode($log->meta));
        $this->assertStringContainsString('Pesan otomatis dari Admin Gym Familly', $log->message);
    }

    public function test_inactive_membership_command_creates_notification_log_once(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 160000,
            'harga_promo' => 145000,
            'deskripsi' => 'FREE pinjaman handuk',
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'tanggal_mulai' => now()->subMonths(2)->format('Y-m-d'),
            'tanggal_berakhir' => now()->subDay()->format('Y-m-d'),
            'status' => 'aktif',
        ]);

        $this->artisan('gym:send-inactive-membership-notifications')->assertSuccessful();
        $this->artisan('gym:send-inactive-membership-notifications')->assertSuccessful();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $member->id,
            'type' => 'membership_inactive',
        ]);

        $this->assertSame(1, NotificationLog::query()->where('type', 'membership_inactive')->count());

        $log = NotificationLog::query()->where('type', 'membership_inactive')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString((string) $membership->id, json_encode($log->meta));
        $this->assertStringContainsString('Pesan otomatis dari Admin Gym Familly', $log->message);
    }
}
