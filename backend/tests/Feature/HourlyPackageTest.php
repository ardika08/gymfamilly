<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use App\Services\MembershipService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HourlyPackageTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $admin = User::factory()->create(['role' => 'admin']);

        return $admin->createToken('test')->plainTextToken;
    }

    public function test_calculate_end_date_uses_hours_when_durasi_jam_is_set(): void
    {
        Carbon::setTestNow('2026-10-09 10:00:00');

        $package = GymPackage::create([
            'nama_paket' => 'Harian 12 Jam',
            'harga_normal' => 25000,
            'durasi_jam' => 12,
        ]);

        $end = app(MembershipService::class)->calculateEndDate($package);

        $this->assertSame('2026-10-09 22:00:00', $end);

        Carbon::setTestNow();
    }

    public function test_calculate_end_date_uses_end_of_day_when_day_based(): void
    {
        Carbon::setTestNow('2026-10-09 10:00:00');

        $package = GymPackage::create([
            'nama_paket' => 'Bulanan',
            'harga_normal' => 160000,
            'durasi_hari' => 30,
        ]);

        $end = app(MembershipService::class)->calculateEndDate($package);

        $this->assertSame('2026-11-08 23:59:59', $end);

        Carbon::setTestNow();
    }

    public function test_admin_can_create_hour_based_package(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->postJson('/api/admin/packages', [
                'nama_paket' => 'Harian 12 Jam',
                'harga_normal' => 25000,
                'durasi_jam' => 12,
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.durasi_jam', 12)
            ->assertJsonPath('data.durasi_hari', null);
    }

    public function test_admin_cannot_create_package_without_any_duration(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->postJson('/api/admin/packages', [
                'nama_paket' => 'Tanpa Durasi',
                'harga_normal' => 25000,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['durasi_hari']);
    }

    public function test_hour_based_membership_activates_with_end_time(): void
    {
        Carbon::setTestNow('2026-10-09 09:00:00');

        $admin = User::factory()->create(['role' => 'admin']);
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => 'Harian 12 Jam',
            'harga_normal' => 25000,
            'durasi_jam' => 12,
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => 'menunggu_pembayaran',
            'payment_method' => 'BCA Manual',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken)
            ->postJson('/api/admin/membership/verify', ['membershipId' => $membership->id]);

        $response->assertOk()->assertJsonPath('data.status', 'aktif');

        $fresh = $membership->fresh();
        $this->assertSame('2026-10-09 21:00:00', $fresh->tanggal_berakhir->format('Y-m-d H:i:s'));
        // Memberikan waktu penuh (bukan format tanggal saja).
        $this->assertSame('2026-10-09 09:00', $fresh->tanggal_mulai->format('Y-m-d H:i'));

        Carbon::setTestNow();
    }

    public function test_current_for_user_expires_hour_based_membership_after_end(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => 'Harian 12 Jam',
            'harga_normal' => 25000,
            'durasi_jam' => 12,
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => 'aktif',
            'tanggal_mulai' => now()->subHours(13),
            'tanggal_berakhir' => now()->subHour(),
        ]);

        $current = app(MembershipService::class)->currentForUser($member);

        $this->assertSame('kedaluwarsa', $current->status);
    }

    public function test_is_expiring_soon_returns_false_for_hour_based_package(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => 'Harian 12 Jam',
            'harga_normal' => 25000,
            'durasi_jam' => 12,
        ]);

        $membership = Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'status' => 'aktif',
            'tanggal_mulai' => now(),
            'tanggal_berakhir' => now()->addHours(12),
        ]);
        $membership->load('package');

        $this->assertFalse(app(MembershipService::class)->isExpiringSoon($membership));
    }
}
