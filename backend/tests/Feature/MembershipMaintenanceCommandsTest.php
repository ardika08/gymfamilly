<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MembershipMaintenanceCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_expire_command_marks_old_pending_duitku_only(): void
    {
        $package = GymPackage::create([
            'nama_paket' => 'Paket Uji',
            'harga_normal' => 15000,
            'deskripsi' => null,
            'durasi_hari' => 1,
        ]);
        $old = User::factory()->create();
        $manual = User::factory()->create();
        $fresh = User::factory()->create();

        $oldMembership = Membership::create([
            'user_id' => $old->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'duitku',
            'payment_url' => 'https://pay.test/old',
        ]);
        $oldMembership->forceFill(['created_at' => now()->subMinutes(1450)])->saveQuietly();

        $manualMembership = Membership::create([
            'user_id' => $manual->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'BCA Manual',
        ]);
        $manualMembership->forceFill(['created_at' => now()->subMinutes(1450)])->saveQuietly();

        $freshMembership = Membership::create([
            'user_id' => $fresh->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'duitku',
        ]);

        $this->artisan('gym:expire-pending-duitku')
            ->expectsOutputToContain('1 transaksi pending')
            ->assertExitCode(0);

        $this->assertSame('kedaluwarsa', $oldMembership->fresh()->status);
        $this->assertNull($oldMembership->fresh()->payment_url);
        $this->assertSame('menunggu_pembayaran', $manualMembership->fresh()->status);
        $this->assertSame('menunggu_pembayaran', $freshMembership->fresh()->status);
    }

    public function test_cleanup_command_preview_excludes_demo_and_active_members(): void
    {
        $package = GymPackage::create([
            'nama_paket' => 'Paket Uji',
            'harga_normal' => 15000,
            'deskripsi' => null,
            'durasi_hari' => 1,
        ]);
        $expired = User::factory()->create(['email' => 'expired@example.com']);
        $active = User::factory()->create(['email' => 'active@example.com']);
        $demo = User::factory()->create(['email' => 'member@gymfamilly.id']);

        Membership::create(['user_id' => $expired->id, 'package_id' => $package->id, 'status' => 'kedaluwarsa']);
        Membership::create(['user_id' => $active->id, 'package_id' => $package->id, 'status' => 'aktif']);
        Membership::create(['user_id' => $demo->id, 'package_id' => $package->id, 'status' => 'kedaluwarsa']);

        $this->artisan('gym:cleanup-inactive-members')
            ->expectsOutputToContain('expired@example.com')
            ->doesntExpectOutputToContain('active@example.com')
            ->doesntExpectOutputToContain('member@gymfamilly.id')
            ->expectsOutputToContain('Preview saja')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', ['id' => $expired->id]);
        $this->assertDatabaseHas('users', ['id' => $active->id]);
        $this->assertDatabaseHas('users', ['id' => $demo->id]);
    }

    public function test_cleanup_execute_deletes_only_non_demo_members_without_active_membership(): void
    {
        $package = GymPackage::create([
            'nama_paket' => 'Paket Uji',
            'harga_normal' => 15000,
            'deskripsi' => null,
            'durasi_hari' => 1,
        ]);
        $expired = User::factory()->create(['email' => 'expired@example.com']);
        $pending = User::factory()->create(['email' => 'pending@example.com']);
        $active = User::factory()->create(['email' => 'active@example.com']);
        $demo = User::factory()->create(['email' => 'member@gymfamilly.id']);

        Membership::create(['user_id' => $expired->id, 'package_id' => $package->id, 'status' => 'kedaluwarsa']);
        Membership::create(['user_id' => $pending->id, 'package_id' => $package->id, 'status' => 'menunggu_pembayaran']);
        Membership::create(['user_id' => $active->id, 'package_id' => $package->id, 'status' => 'aktif']);
        Membership::create(['user_id' => $demo->id, 'package_id' => $package->id, 'status' => 'kedaluwarsa']);

        $this->artisan('gym:cleanup-inactive-members', ['--execute' => true])
            ->expectsOutputToContain('Dihapus: 2')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('users', ['id' => $expired->id]);
        $this->assertDatabaseMissing('users', ['id' => $pending->id]);
        $this->assertDatabaseHas('users', ['id' => $active->id]);
        $this->assertDatabaseHas('users', ['id' => $demo->id]);
    }
}
