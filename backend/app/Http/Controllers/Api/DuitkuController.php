<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GymPackage;
use App\Models\Membership;
use App\Services\DuitkuService;
use App\Services\MembershipService;
use App\Services\StarsenderService;
use App\Services\VoucherService;
use App\Services\WhatsAppTemplateService;
use App\Support\ApiResponse;
use App\Support\GymPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DuitkuController extends Controller
{
    public function __construct(
        private readonly DuitkuService $duitku,
        private readonly MembershipService $memberships,
        private readonly StarsenderService $starsender,
        private readonly WhatsAppTemplateService $templates,
        private readonly VoucherService $vouchers,
    ) {}

    /**
     * Buat transaksi pembayaran online via Duitku.
     * Dipanggil oleh member setelah pilih paket + metode bayar online.
     */
    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'packageId'    => ['required', 'exists:packages,id'],
            'paymentMethod' => ['required', 'string', 'max:5'],
            'voucherKode'  => ['nullable', 'string', 'max:50'],
        ]);

        if (!$this->duitku->isConfigured()) {
            return ApiResponse::error('Payment gateway belum dikonfigurasi.', 503);
        }

        if ($this->memberships->hasActiveMembership($request->user())) {
            return ApiResponse::error('Membership aktif masih berjalan.', 422);
        }

        $anyPending = $request->user()->memberships()
            ->where('status', 'menunggu_pembayaran')
            ->exists();

        if ($anyPending) {
            return ApiResponse::error('Masih ada membership yang menunggu pembayaran.', 422);
        }

        $package = GymPackage::findOrFail($validated['packageId']);
        $harga   = $package->harga_promo ?? $package->harga_normal;

        // Validasi voucher jika ada
        $voucherId     = null;
        $voucherDiskon = 0;
        $vResult       = null;

        if (!empty($validated['voucherKode'])) {
            $vResult = $this->vouchers->validate($validated['voucherKode'], $request->user()->id, $harga);
            if (!$vResult['valid']) {
                return ApiResponse::error($vResult['message'], 422);
            }
            $voucherId     = $vResult['voucher']->id;
            $voucherDiskon = $vResult['diskon'];
        }

        $amount = max(1000, $harga - $voucherDiskon); // minimum Rp 1.000 utk Duitku

        // Buat membership dengan status menunggu
        $membership = Membership::create([
            'user_id'        => $request->user()->id,
            'package_id'     => $package->id,
            'status'         => 'menunggu_pembayaran',
            'payment_method' => 'duitku',
            'payment_channel' => $validated['paymentMethod'],
            'voucher_id'     => $voucherId,
            'voucher_diskon' => $voucherDiskon,
        ]);

        $membership->load(['user', 'package']);

        // Catat pemakaian voucher
        if ($voucherId && $vResult) {
            $this->vouchers->recordUsage($vResult['voucher'], $request->user()->id, $membership->id);
        }

        // Buat transaksi di Duitku
        $result = $this->duitku->createTransaction(
            $membership,
            $validated['paymentMethod'],
            $amount,
            "Membership {$package->nama_paket} - Gym Familly",
        );

        if (!$result['success']) {
            $membership->delete();

            return ApiResponse::error($result['message'] ?? 'Gagal membuat transaksi.', 422);
        }

        // Update membership dengan data Duitku
        $membership->update([
            'merchant_order_id' => $result['merchant_order_id'],
            'duitku_reference' => $result['reference'],
        ]);

        return ApiResponse::success([
            'membership' => GymPayload::membership($membership->fresh()),
            'payment_url' => $result['payment_url'],
            'va_number' => $result['va_number'],
            'qr_string' => $result['qr_string'],
            'reference' => $result['reference'],
            'amount' => $result['amount'],
        ], 'Transaksi pembayaran berhasil dibuat.', 201);
    }

    /**
     * Ambil daftar metode pembayaran yang tersedia dari Duitku.
     */
    public function paymentMethods(Request $request)
    {
        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:10000'],
        ]);

        if (!$this->duitku->isConfigured()) {
            return ApiResponse::error('Payment gateway belum dikonfigurasi.', 503);
        }

        $result = $this->duitku->getPaymentMethods($validated['amount']);

        if (!$result['success']) {
            return ApiResponse::error($result['message'] ?? 'Gagal mengambil metode pembayaran.', 422);
        }

        return ApiResponse::success($result['methods']);
    }

    /**
     * Cek status transaksi (dipanggil frontend untuk polling).
     */
    public function checkStatus(Request $request)
    {
        $validated = $request->validate([
            'membershipId' => ['required', 'exists:memberships,id'],
        ]);

        $membership = Membership::where('user_id', $request->user()->id)
            ->findOrFail($validated['membershipId']);

        if (!$membership->merchant_order_id) {
            return ApiResponse::error('Transaksi Duitku tidak ditemukan.', 404);
        }

        $result = $this->duitku->checkTransaction($membership->merchant_order_id);

        return ApiResponse::success([
            'membership' => GymPayload::membership($membership),
            'transaction_status' => $result['status_code'] ?? null,
            'status_message' => $result['status_message'] ?? null,
        ]);
    }

    /**
     * Webhook callback dari Duitku.
     * Dipanggil otomatis oleh Duitku setelah pembayaran berhasil/gagal.
     */
    public function webhook(Request $request)
    {
        $merchantCode = $request->input('merchantCode', '');
        $amount = $request->input('amount', '');
        $merchantOrderId = $request->input('merchantOrderId', '');
        $resultCode = $request->input('resultCode', '');
        $signature = $request->input('signature', '');
        $reference = $request->input('reference', '');

        // Validasi signature
        if (!$this->duitku->validateCallback($merchantCode, $amount, $merchantOrderId, $signature)) {
            Log::warning('Duitku webhook: invalid signature', [
                'merchantOrderId' => $merchantOrderId,
            ]);

            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        // Cari membership berdasarkan merchant_order_id
        $membership = Membership::with(['user', 'package'])
            ->where('merchant_order_id', $merchantOrderId)
            ->first();

        if (!$membership) {
            Log::warning('Duitku webhook: membership not found', [
                'merchantOrderId' => $merchantOrderId,
            ]);

            return response()->json(['message' => 'Order not found.'], 404);
        }

        // resultCode '00' = sukses
        if ($resultCode === '00') {
            $membership->update([
                'status' => 'aktif',
                'tanggal_mulai' => now()->format('Y-m-d'),
                'tanggal_berakhir' => $this->memberships->calculateEndDate($membership->package),
                'duitku_reference' => $reference,
                'verified_at' => now(),
                'paid_at' => now(),
            ]);

            // Kirim notifikasi WhatsApp ke member
            if ($membership->user) {
                $this->starsender->send(
                    $membership->user,
                    'payment_verified',
                    $this->templates->paymentVerified($membership->user, $membership, $membership->package),
                    ['membership_id' => $membership->id, 'via' => 'duitku'],
                );
            }

            Log::info('Duitku webhook: payment success', [
                'merchantOrderId' => $merchantOrderId,
                'membership_id' => $membership->id,
            ]);
        } else {
            // Pembayaran gagal/expired
            $membership->update([
                'status' => 'kedaluwarsa',
                'duitku_reference' => $reference,
            ]);

            Log::info('Duitku webhook: payment failed/expired', [
                'merchantOrderId' => $merchantOrderId,
                'resultCode' => $resultCode,
            ]);
        }

        return response()->json(['message' => 'OK']);
    }
}
