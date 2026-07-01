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

    public function calculateEndDate(string $packageName): string
    {
        $endDate = Carbon::today();

        if (str_contains($packageName, '12 Bulan')) {
            return $endDate->addMonths(12)->format('Y-m-d');
        }

        if (str_contains($packageName, '6 Bulan')) {
            return $endDate->addMonths(6)->format('Y-m-d');
        }

        if (str_contains($packageName, '3 Bulan')) {
            return $endDate->addMonths(3)->format('Y-m-d');
        }

        if (str_contains($packageName, 'Harian')) {
            return $endDate->addDay()->format('Y-m-d');
        }

        return $endDate->addMonth()->format('Y-m-d');
    }

    public function qrPayload(Membership $membership): string
    {
        return sprintf('GF|member:%d|membership:%d', $membership->user_id, $membership->id);
    }
}
