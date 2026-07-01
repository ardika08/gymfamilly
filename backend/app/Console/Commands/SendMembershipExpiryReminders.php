<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MembershipService;
use App\Services\StarsenderService;
use App\Services\WhatsAppTemplateService;
use Illuminate\Console\Command;

class SendMembershipExpiryReminders extends Command
{
    protected $signature = 'gym:send-membership-reminders';

    protected $description = 'Kirim reminder WhatsApp H-3 membership ke member aktif';

    public function handle(
        MembershipService $memberships,
        StarsenderService $starsender,
        WhatsAppTemplateService $templates,
    ): int
    {
        User::query()->where('role', 'member')->get()->each(function (User $user) use ($memberships, $starsender, $templates) {
            $membership = $memberships->currentForUser($user);
            $daysRemaining = $memberships->daysRemaining($membership);

            if ($membership?->status !== 'aktif' || $daysRemaining !== 3) {
                return;
            }

            if ($starsender->hasSentForMembership('membership_expiry_reminder', $membership->id)) {
                return;
            }

            $starsender->send(
                $user,
                'membership_expiry_reminder',
                $templates->membershipExpiryReminder($user, $membership),
                ['membership_id' => $membership->id],
            );
        });

        $this->info('Reminder membership selesai diproses.');

        return self::SUCCESS;
    }
}
