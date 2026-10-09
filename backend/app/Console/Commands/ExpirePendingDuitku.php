<?php

namespace App\Console\Commands;

use App\Models\Membership;
use Illuminate\Console\Command;

class ExpirePendingDuitku extends Command
{
    protected $signature = 'gym:expire-pending-duitku';

    protected $description = 'Ubah status transaksi Duitku yang sudah lewat masa berlaku dan grace period menjadi kedaluwarsa';

    public function handle(): int
    {
        $expiryCutoff = now()->subMinutes(
            (int) config('services.duitku.expiry_period', 1440)
            + (int) config('services.duitku.expiry_grace_minutes', 5)
        );

        $count = Membership::where('status', 'menunggu_pembayaran')
            ->where('payment_method', 'duitku')
            ->where('payment_url', '!=', null)
            ->where('created_at', '<=', $expiryCutoff)
            ->update([
                'status' => 'kedaluwarsa',
                'payment_url' => null,
            ]);

        $this->info("{$count} transaksi pending Duitku yang lewat batas diubah menjadi kedaluwarsa.");

        return self::SUCCESS;
    }
}