<?php

namespace App\Services;

use App\Models\Membership;
use App\Models\Voucher;
use App\Models\VoucherUsage;
use Illuminate\Support\Facades\DB;

class VoucherService
{
    /**
     * Validasi voucher untuk user + paket tertentu.
     * Return ['valid' => true, 'voucher' => ..., 'diskon' => ...]
     * atau    ['valid' => false, 'message' => ...]
     */
    public function validate(string $kode, int $userId, int $harga): array
    {
        $voucher = Voucher::where('kode', strtoupper(trim($kode)))->first();

        if (!$voucher) {
            return ['valid' => false, 'message' => 'Kode voucher tidak ditemukan.'];
        }

        if ($voucher->status !== 'aktif') {
            return ['valid' => false, 'message' => 'Kode voucher tidak aktif.'];
        }

        $now = now();
        if ($voucher->valid_dari && $now->lt($voucher->valid_dari)) {
            return ['valid' => false, 'message' => 'Voucher belum berlaku.'];
        }
        if ($voucher->valid_hingga && $now->gt($voucher->valid_hingga)) {
            return ['valid' => false, 'message' => 'Voucher sudah kadaluarsa.'];
        }

        if ($voucher->maks_penggunaan !== null && $voucher->totalUsed() >= $voucher->maks_penggunaan) {
            return ['valid' => false, 'message' => 'Kuota voucher sudah habis.'];
        }

        if ($voucher->usedByUser($userId) >= $voucher->maks_per_user) {
            return ['valid' => false, 'message' => 'Kamu sudah menggunakan voucher ini.'];
        }

        $diskon = $voucher->hitungDiskon($harga);

        return [
            'valid'         => true,
            'voucher'       => $voucher,
            'diskon'        => $diskon,
            'harga_akhir'   => max(0, $harga - $diskon),
            'bonus_days'    => $voucher->tipe === 'bonus_days' ? $voucher->nilai : 0,
        ];
    }

    /**
     * Catat pemakaian voucher setelah membership aktif.
     */
    public function recordUsage(Voucher $voucher, int $userId, int $membershipId): void
    {
        VoucherUsage::create([
            'voucher_id'    => $voucher->id,
            'user_id'       => $userId,
            'membership_id' => $membershipId,
        ]);
    }
}
