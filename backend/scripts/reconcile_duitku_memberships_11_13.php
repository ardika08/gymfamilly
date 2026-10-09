<?php

use App\Models\Membership;
use App\Services\DuitkuService;
use App\Services\MembershipService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$targetIds = [11, 12, 13];
$duitku = app(DuitkuService::class);
$membershipService = app(MembershipService::class);
$memberships = Membership::with(['user', 'package'])
    ->whereIn('id', $targetIds)
    ->orderBy('id')
    ->get();

$backupPath = storage_path('app/reconcile-duitku-11-13-'.now()->format('Ymd-His').'.json');
file_put_contents(
    $backupPath,
    json_encode($memberships->map->getAttributes()->all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
);

echo "Backup: {$backupPath}\n";

foreach ($targetIds as $id) {
    $membership = $memberships->firstWhere('id', $id);

    if (!$membership) {
        echo "#{$id} SKIP: membership tidak ditemukan.\n";
        continue;
    }

    if ($membership->payment_method !== 'duitku' || !$membership->merchant_order_id) {
        echo "#{$id} SKIP: bukan transaksi Duitku yang dapat diverifikasi.\n";
        continue;
    }

    $result = $duitku->checkTransaction($membership->merchant_order_id);
    if (!$result['success']) {
        echo "#{$id} SKIP: ".($result['message'] ?? 'status Duitku gagal diperiksa')."\n";
        continue;
    }

    $basePrice = $membership->package->harga_promo ?? $membership->package->harga_normal;
    $expectedAmount = max(1000, $basePrice - (int) ($membership->voucher_diskon ?? 0));
    $receivedAmount = (int) ($result['amount'] ?? 0);
    $statusCode = (string) ($result['status_code'] ?? '');
    $statusMessage = (string) ($result['status_message'] ?? '-');

    if ($receivedAmount !== $expectedAmount) {
        echo "#{$id} SKIP: nominal tidak cocok; lokal={$expectedAmount}, Duitku={$receivedAmount}.\n";
        continue;
    }

    DB::transaction(function () use ($membership, $membershipService, $result, $statusCode): void {
        if ($statusCode === '00') {
            $now = now();
            $membership->update([
                'status' => 'aktif',
                'tanggal_mulai' => $membership->tanggal_mulai ?? $now->format('Y-m-d'),
                'tanggal_berakhir' => $membership->tanggal_berakhir
                    ?? $membershipService->calculateEndDate($membership->package),
                'paid_at' => $membership->paid_at ?? $now,
                'verified_at' => $membership->verified_at ?? $now,
                'duitku_reference' => $result['reference'] ?? $membership->duitku_reference,
                'payment_url' => null,
            ]);

            return;
        }

        if ($statusCode === '01') {
            $membership->update([
                'status' => 'menunggu_pembayaran',
                'tanggal_mulai' => null,
                'tanggal_berakhir' => null,
                'paid_at' => null,
                'verified_at' => null,
                'duitku_reference' => $result['reference'] ?? $membership->duitku_reference,
            ]);

            return;
        }

        if ($statusCode === '02') {
            $membership->update([
                'status' => 'kedaluwarsa',
                'tanggal_mulai' => null,
                'tanggal_berakhir' => null,
                'paid_at' => null,
                'verified_at' => null,
                'duitku_reference' => $result['reference'] ?? $membership->duitku_reference,
                'payment_url' => null,
            ]);
        }
    });

    $membership->refresh();
    if (!in_array($statusCode, ['00', '01', '02'], true)) {
        echo "#{$id} SKIP: status Duitku {$statusCode} {$statusMessage} tidak dikenal.\n";
        continue;
    }

    echo "#{$id} OK: Duitku={$statusCode} {$statusMessage}; lokal={$membership->status}; paid="
        .($membership->paid_at?->format('Y-m-d H:i') ?? 'NULL')
        ."; verified=".($membership->verified_at?->format('Y-m-d H:i') ?? 'NULL')."\n";
}
