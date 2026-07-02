<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Voucher extends Model
{
    protected $fillable = [
        'kode',
        'deskripsi',
        'tipe',
        'nilai',
        'maks_penggunaan',
        'maks_per_user',
        'valid_dari',
        'valid_hingga',
        'status',
    ];

    protected $casts = [
        'valid_dari'  => 'datetime',
        'valid_hingga' => 'datetime',
    ];

    public function usages(): HasMany
    {
        return $this->hasMany(VoucherUsage::class);
    }

    public function totalUsed(): int
    {
        return $this->usages()->count();
    }

    public function usedByUser(int $userId): int
    {
        return $this->usages()->where('user_id', $userId)->count();
    }

    /**
     * Hitung nominal diskon berdasarkan harga paket.
     */
    public function hitungDiskon(int $harga): int
    {
        return match ($this->tipe) {
            'percent'    => (int) round($harga * $this->nilai / 100),
            'fixed'      => min($this->nilai, $harga),
            'free'       => $harga,
            'bonus_days' => 0, // tidak mengurangi harga
            default      => 0,
        };
    }
}
