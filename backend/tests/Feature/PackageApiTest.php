<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PackageApiTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $admin = User::factory()->create(['role' => 'admin']);

        return $admin->createToken('test')->plainTextToken;
    }

    public function test_admin_can_create_package_without_harga_promo_and_deskripsi(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->postJson('/api/admin/packages', [
                'nama_paket' => 'Paket Harian',
                'harga_normal' => 25000,
                'durasi_hari' => 1,
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.harga_promo', null)
            ->assertJsonPath('data.deskripsi', null);

        $this->assertDatabaseHas('packages', [
            'nama_paket' => 'Paket Harian',
            'harga_promo' => null,
            'deskripsi' => null,
        ]);
    }

    public function test_admin_can_clear_harga_promo_and_deskripsi_on_update(): void
    {
        $package = GymPackage::create([
            'nama_paket' => 'Paket 1 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 160000,
            'harga_promo' => 120000,
            'deskripsi' => 'Akses penuh 30 hari',
            'durasi_hari' => 30,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->putJson("/api/admin/packages/{$package->id}", [
                'nama_paket' => 'Paket 1 Bulan',
                'harga_normal' => 160000,
                'harga_promo' => null,
                'deskripsi' => null,
                'durasi_hari' => 30,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.harga_promo', null)
            ->assertJsonPath('data.deskripsi', null);

        $this->assertDatabaseHas('packages', [
            'id' => $package->id,
            'harga_promo' => null,
            'deskripsi' => null,
        ]);
    }

    public function test_admin_can_create_package_with_empty_string_promo_and_deskripsi(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->postJson('/api/admin/packages', [
                'nama_paket' => 'Paket Pelajar',
                'harga_normal' => 100000,
                'harga_promo' => '',
                'deskripsi' => '',
                'durasi_hari' => 30,
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.harga_promo', null)
            ->assertJsonPath('data.deskripsi', null);
    }

    public function test_admin_cannot_create_package_without_nama_paket(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->postJson('/api/admin/packages', [
                'harga_normal' => 25000,
                'durasi_hari' => 1,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['nama_paket']);
    }

    public function test_admin_cannot_create_package_without_harga_normal(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken())
            ->postJson('/api/admin/packages', [
                'nama_paket' => 'Paket Harian',
                'durasi_hari' => 1,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['harga_normal']);
    }
}
