<?php

namespace App\Services;

use App\Models\Membership;
use App\Models\User;
use Carbon\Carbon;

class MembershipService
{
    public function currentForUser(User $user): ?Membership
    {
        $membership = $user->memberships()->latest('id')->first();

        if (! $membership) {
            return null;
        }

        if (
            $membership->status === 'aktif' &&
            $membership->tanggal_berakhir &&
            Carbon::parse($membership->tanggal_berakhir)->lt(Carbon::today())
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

    public function isExpiringSoon(?Membership $membership): bool
    {
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
     * Hitung tanggal berakhir berdasarkan kolom durasi_hari di package.
     * Menerima GymPackage object atau jumlah hari langsung.
     */
    public function calculateEndDate(\App\Models\GymPackage|int $package): string
    {
        $days = $package instanceof \App\Models\GymPackage
            ? $package->durasi_hari
            : $package;

        return Carbon::today()->addDays($days)->format('Y-m-d');
    }

    public function qrPayload(Membership $membership): string
    {
        return sprintf('GF|member:%d|membership:%d', $membership->user_id, $membership->id);
    }
}
