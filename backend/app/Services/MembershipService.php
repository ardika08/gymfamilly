<?php

namespace App\Services;

use App\Models\GymPackage;
use App\Models\Membership;
use App\Models\User;
use Carbon\Carbon;

class MembershipService
{
    public function currentForUser(User $user): ?Membership
    {
        $membership = $user->memberships()->with('package')->latest('id')->first();

        if (! $membership) {
            return null;
        }

        if (
            $membership->status === 'aktif' &&
            $membership->tanggal_berakhir &&
            Carbon::parse($membership->tanggal_berakhir)->lt(now())
        ) {
            $membership->status = 'kedaluwarsa';
            $membership->save();
            $membership->refresh();
        }

        return $membership;
    }

    public function hasActiveMembership(User $user): bool
    {
        return $this->currentForUser($user)?->status === 'aktif';
    }

    /**
     * True jika paket ini berbasis jam (durasi_jam terisi), bukan hari.
     */
    public function isHourBased(?Membership $membership): bool
    {
        return (bool) ($membership?->package?->durasi_jam);
    }

    public function isExpiringSoon(?Membership $membership): bool
    {
        // Paket berbasis jam tidak punya konsep "H-3", lewati.
        if ($this->isHourBased($membership)) {
            return false;
        }

        $days = $this->daysRemaining($membership);

        return $membership?->status === 'aktif' && $days !== null && $days <= 3;
    }

    public function daysRemaining(?Membership $membership): ?int
    {
        if (! $membership?->tanggal_berakhir) {
            return null;
        }

        return Carbon::today()->diffInDays(Carbon::parse($membership->tanggal_berakhir), false);
    }

    /**
     * Hitung tanggal berakhir berdasarkan durasi paket.
     * - Jika paket punya durasi_jam → berakhir now() + N jam (presisi ke menit).
     * - Jika tidak → berakhir akhir hari (23:59:59) dari today + durasi_hari.
     * Menerima GymPackage object atau jumlah hari langsung (kompatibilitas lama).
     */
    public function calculateEndDate(GymPackage|int $package): string
    {
        $hours = null;
        $days = 0;

        if ($package instanceof GymPackage) {
            $hours = $package->durasi_jam ? (int) $package->durasi_jam : null;
            $days = (int) $package->durasi_hari;
        } else {
            $days = (int) $package;
        }

        if ($hours) {
            return now()->addHours($hours)->format('Y-m-d H:i:s');
        }

        return Carbon::today()->addDays($days)->endOfDay()->format('Y-m-d H:i:s');
    }

    public function qrPayload(Membership $membership): string
    {
        return sprintf('GF|member:%d|membership:%d', $membership->user_id, $membership->id);
    }
}
