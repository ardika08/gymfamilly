<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MembershipService;
use App\Services\StarsenderService;
use App\Services\WhatsAppTemplateService;
use Illuminate\Console\Command;

class SendInactiveMembershipNotifications extends Command
{
    protected $signature = 'gym:send-inactive-membership-notifications';

    protected $description = 'Kirim notifikasi WhatsApp untuk membership yang sudah tidak aktif';

    public function handle(
        MembershipService $memberships,
        StarsenderService $starsender,
        WhatsAppTemplateService $templates,
    ): int
    {
        User::query()->where('role', 'member')->get()->each(function (User $user) use ($memberships, $starsender, $templates) {
            $membership = $memberships->currentForUser($user);

            if ($membership?->status !== 'kedaluwarsa') {
                return;
            }

            if ($starsender->hasSentForMembership('membership_inactive', $membership->id)) {
                return;
            }

            $starsender->send(
                $user,
                'membership_inactive',
                $templates->membershipInactive($user, $membership),
                ['membership_id' => $membership->id],
            );
        });

        $this->info('Notifikasi membership tidak aktif selesai diproses.');

        return self::SUCCESS;
    }
}
