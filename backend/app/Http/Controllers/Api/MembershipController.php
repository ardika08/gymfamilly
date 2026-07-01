<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use App\Services\MembershipService;
use App\Services\VoucherService;
use App\Support\ApiResponse;
use App\Support\GymPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MembershipController extends Controller
{
    public function __construct(
        private readonly MembershipService $memberships,
        private readonly VoucherService $vouchers,
    ) {}

    public function listForMember(Request $request)
    {
        $items = $request->user()->memberships()->latest('id')->get()
            ->map(fn (Membership $membership) => GymPayload::membership($membership));

        return ApiResponse::success($items);
    }

    public function currentForMember(Request $request)
    {
        return ApiResponse::success(GymPayload::membership($this->memberships->currentForUser($request->user())));
    }

    public function currentForAdmin(int $userId)
    {
        $membership = $this->memberships->currentForUser(User::findOrFail($userId));

        return ApiResponse::success(GymPayload::membership($membership));
    }

    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'packageId'     => ['required', 'exists:packages,id'],
            'paymentMethod' => ['nullable', 'string', 'max:255'],
            'voucherKode'   => ['nullable', 'string', 'max:50'],
        ]);

        if ($this->memberships->hasActiveMembership($request->user())) {
            return ApiResponse::error('Membership aktif masih berjalan. Checkout baru belum diperbolehkan.', 422);
        }

        $anyPending = $request->user()->memberships()
            ->where('status', 'menunggu_pembayaran')
            ->exists();

        if ($anyPending) {
            return ApiResponse::error('Masih ada membership yang menunggu verifikasi pembayaran.', 422);
        }

        $package = GymPackage::findOrFail($validated['packageId']);
        $harga   = $package->harga_promo ?? $package->harga_normal;

        // Validasi voucher jika ada
        $voucherId   = null;
        $voucherDiskon = 0;

        if (!empty($validated['voucherKode'])) {
            $vResult = $this->vouchers->validate($validated['voucherKode'], $request->user()->id, $harga);
            if (!$vResult['valid']) {
                return ApiResponse::error($vResult['message'], 422);
            }
            $voucherId     = $vResult['voucher']->id;
            $voucherDiskon = $vResult['diskon'];
        }

        $membership = Membership::create([
            'user_id'        => $request->user()->id,
            'package_id'     => $validated['packageId'],
            'status'         => 'menunggu_pembayaran',
            'payment_method' => $validated['paymentMethod'] ?? 'BCA Manual',
            'voucher_id'     => $voucherId,
            'voucher_diskon' => $voucherDiskon,
        ]);

        // Catat pemakaian voucher
        if ($voucherId) {
            $this->vouchers->recordUsage($vResult['voucher'], $request->user()->id, $membership->id);
        }

        return ApiResponse::success(GymPayload::membership($membership), 'Checkout membership berhasil dibuat.', 201);
    }

    public function uploadProof(Request $request)
    {
        $validated = $request->validate([
            'membershipId' => ['required', 'integer'],
            'paymentMethod' => ['nullable', 'string', 'max:255'],
            'payment_proof_file' => ['required', 'image', 'max:5120'],
        ]);

        $membership = $request->user()->memberships()
            ->whereKey($validated['membershipId'])
            ->first();

        if (! $membership) {
            return ApiResponse::error('Data membership tidak ditemukan.', 404);
        }

        $path = $request->file('payment_proof_file')->store('payment-proofs', 'public');

        if ($membership->payment_proof) {
            Storage::disk('public')->delete($membership->payment_proof);
        }

        $membership->update([
            'payment_method' => $validated['paymentMethod'] ?? $membership->payment_method,
            'payment_proof' => $path,
        ]);

        return ApiResponse::success(GymPayload::membership($membership->fresh()), 'Bukti pembayaran berhasil diunggah.');
    }

    public function barcode(Request $request)
    {
        $membership = $this->memberships->currentForUser($request->user());

        if (! $membership || $membership->status !== 'aktif') {
            return ApiResponse::success(null);
        }

        return ApiResponse::success([
            'membership' => GymPayload::membership($membership),
            'barcode' => $this->memberships->qrPayload($membership),
        ]);
    }
}
