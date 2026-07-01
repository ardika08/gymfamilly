<?php

namespace Tests\Feature;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MembershipApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_checkout_and_upload_payment_proof(): void
    {
        Storage::fake('public');
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 160000,
            'harga_promo' => 145000,
            'deskripsi' => 'FREE pinjaman handuk',
        ]);

        $token = $member->createToken('test')->plainTextToken;

        $checkout = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/membership/checkout', [
                'packageId' => $package->id,
                'paymentMethod' => 'BCA Manual',
            ]);

        $checkout->assertCreated()->assertJsonPath('data.status', 'menunggu_pembayaran');

        $membershipId = $checkout->json('data.id');

        $upload = $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/membership/upload-proof', [
                'membershipId' => $membershipId,
                'paymentMethod' => 'BCA Manual',
                'payment_proof_file' => UploadedFile::fake()->image('proof.jpg'),
            ]);

        $upload->assertOk()->assertJsonPath('data.payment_method', 'BCA Manual');
        Storage::disk('public')->assertExists(Membership::findOrFail($membershipId)->payment_proof);
    }

    public function test_member_cannot_checkout_when_active_membership_exists(): void
    {
        $member = User::factory()->create();
        $package = GymPackage::create([
            'nama_paket' => '1 Bulan',
            'promo_label' => 'Promo Coret',
            'harga_normal' => 160000,
            'harga_promo' => 145000,
            'deskripsi' => 'FREE pinjaman handuk',
        ]);

        Membership::create([
            'user_id' => $member->id,
            'package_id' => $package->id,
            'tanggal_mulai' => now()->format('Y-m-d'),
            'tanggal_berakhir' => now()->addMonth()->format('Y-m-d'),
            'status' => 'aktif',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$member->createToken('test')->plainTextToken)
            ->postJson('/api/membership/checkout', [
                'packageId' => $package->id,
            ]);

        $response->assertUnprocessable();
    }
}
